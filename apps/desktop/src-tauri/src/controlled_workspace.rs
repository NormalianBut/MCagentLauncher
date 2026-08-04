use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

const SCHEMA_VERSION: &str = "1.0.0";
const POLICY_VERSION: &str = "controlled-workspace-v1";
const ROOT_DIRECTORY: &str = "executor-controlled-v1";
const TRANSACTIONS_DIRECTORY: &str = "transactions";
const JOURNAL_DIRECTORY: &str = "journal";
const ARTIFACTS_DIRECTORY: &str = "artifacts";
const ARTIFACT_FILE: &str = "simulation-marker.json";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceError {
    code: &'static str,
    message: String,
}

impl WorkspaceError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn user_message(&self) -> String {
        format!("{}: {}", self.code, self.message)
    }
}

impl fmt::Display for WorkspaceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for WorkspaceError {}

type Result<T> = std::result::Result<T, WorkspaceError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TransactionState {
    Proposed,
    AwaitingConfirmation,
    Ready,
    Staging,
    Committing,
    Committed,
    RecoveryRequired,
    RollingBack,
    RolledBack,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SimulationOperation {
    Commit,
    Interruption,
}

impl SimulationOperation {
    fn as_str(self) -> &'static str {
        match self {
            Self::Commit => "commit",
            Self::Interruption => "interruption",
        }
    }

    fn parse(value: &str) -> Result<Self> {
        match value {
            "commit" => Ok(Self::Commit),
            "interruption" => Ok(Self::Interruption),
            _ => Err(WorkspaceError::new(
                "OPERATION_INVALID",
                "The simulation operation must be exactly commit or interruption.",
            )),
        }
    }
}

impl TransactionState {
    fn as_str(self) -> &'static str {
        match self {
            Self::Proposed => "proposed",
            Self::AwaitingConfirmation => "awaiting_confirmation",
            Self::Ready => "ready",
            Self::Staging => "staging",
            Self::Committing => "committing",
            Self::Committed => "committed",
            Self::RecoveryRequired => "recovery_required",
            Self::RollingBack => "rolling_back",
            Self::RolledBack => "rolled_back",
        }
    }

    fn parse(value: &str) -> Result<Self> {
        match value {
            "proposed" => Ok(Self::Proposed),
            "awaiting_confirmation" => Ok(Self::AwaitingConfirmation),
            "ready" => Ok(Self::Ready),
            "staging" => Ok(Self::Staging),
            "committing" => Ok(Self::Committing),
            "committed" => Ok(Self::Committed),
            "recovery_required" => Ok(Self::RecoveryRequired),
            "rolling_back" => Ok(Self::RollingBack),
            "rolled_back" => Ok(Self::RolledBack),
            _ => Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal contains an unknown state.",
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct JournalEvent {
    sequence: u32,
    transaction_id: String,
    from_state: TransactionState,
    to_state: TransactionState,
    result: &'static str,
    previous_checksum: Option<String>,
    checksum: String,
}

impl JournalEvent {
    fn new(
        sequence: u32,
        transaction_id: &str,
        from_state: TransactionState,
        to_state: TransactionState,
        result: &'static str,
        previous_checksum: Option<String>,
    ) -> Self {
        let payload = journal_checksum_payload(
            sequence,
            transaction_id,
            from_state,
            to_state,
            result,
            previous_checksum.as_deref(),
        );
        Self {
            sequence,
            transaction_id: transaction_id.to_owned(),
            from_state,
            to_state,
            result,
            previous_checksum,
            checksum: sha256_hex(payload.as_bytes()),
        }
    }

    fn render(&self) -> String {
        format!(
            "{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"eventId\":\"event-{}-{sequence:08}\",\"sequence\":{sequence},\"transactionId\":\"{}\",\"fromState\":\"{}\",\"toState\":\"{}\",\"result\":\"{}\",\"previousChecksum\":{},\"checksum\":\"{}\"}}\n",
            self.transaction_id,
            self.transaction_id,
            self.from_state.as_str(),
            self.to_state.as_str(),
            self.result,
            self.previous_checksum.as_ref().map(|value| format!("\"{value}\"")).unwrap_or_else(|| "null".to_owned()),
            self.checksum,
            sequence = self.sequence,
        )
    }

    fn parse(text: &str) -> Result<Self> {
        let schema = json_string(text, "schemaVersion")?;
        if schema != SCHEMA_VERSION {
            return Err(WorkspaceError::new(
                "SCHEMA_UNSUPPORTED",
                "The journal schema version is unsupported.",
            ));
        }
        let sequence = json_u32(text, "sequence")?;
        let transaction_id = json_string(text, "transactionId")?;
        validate_identifier(&transaction_id, "transaction")?;
        let from_state = TransactionState::parse(&json_string(text, "fromState")?)?;
        let to_state = TransactionState::parse(&json_string(text, "toState")?)?;
        let result_value = json_string(text, "result")?;
        let result = match result_value.as_str() {
            "accepted" => "accepted",
            "interrupted" => "interrupted",
            _ => {
                return Err(WorkspaceError::new(
                    "JOURNAL_INVALID",
                    "The journal result is unsupported.",
                ))
            }
        };
        let previous_checksum = json_nullable_string(text, "previousChecksum")?;
        let checksum = json_string(text, "checksum")?;
        if !is_lower_hex(&checksum, 64)
            || previous_checksum
                .as_ref()
                .is_some_and(|value| !is_lower_hex(value, 64))
        {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal checksum is malformed.",
            ));
        }
        let parsed = Self {
            sequence,
            transaction_id,
            from_state,
            to_state,
            result,
            previous_checksum,
            checksum,
        };
        let expected_checksum = sha256_hex(
            journal_checksum_payload(
                parsed.sequence,
                &parsed.transaction_id,
                parsed.from_state,
                parsed.to_state,
                parsed.result,
                parsed.previous_checksum.as_deref(),
            )
            .as_bytes(),
        );
        if parsed.checksum != expected_checksum || parsed.render() != text {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal event is not canonical or its checksum is invalid.",
            ));
        }
        Ok(parsed)
    }
}

pub struct ControlledWorkspace {
    app_data_dir: PathBuf,
}

impl ControlledWorkspace {
    pub fn from_app_data_dir(app_data_dir: PathBuf) -> Result<Self> {
        if !app_data_dir.is_absolute() {
            return Err(WorkspaceError::new(
                "APP_DATA_INVALID",
                "The application data boundary must be absolute.",
            ));
        }
        Ok(Self { app_data_dir })
    }

    #[cfg(test)]
    fn for_test(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn preview(
        &self,
        workspace_id: &str,
        transaction_id: &str,
        operation: &str,
    ) -> Result<String> {
        validate_identifier(workspace_id, "workspace")?;
        validate_identifier(transaction_id, "transaction")?;
        let operation = SimulationOperation::parse(operation)?;
        let token = confirmation_token(workspace_id, transaction_id, operation);
        Ok(format!(
            "{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"mode\":\"dry-run\",\"workspaceKind\":\"app-managed\",\"workspaceId\":\"{workspace_id}\",\"transactionId\":\"{transaction_id}\",\"policyVersion\":\"{POLICY_VERSION}\",\"simulationOperation\":\"{}\",\"willCreateTestArtifact\":true,\"willAccessMinecraft\":false,\"willUseNetwork\":false,\"confirmationToken\":\"{token}\"}}",
            operation.as_str(),
        ))
    }

    pub fn confirm_and_begin(
        &self,
        workspace_id: &str,
        transaction_id: &str,
        operation: &str,
        confirmation: &str,
    ) -> Result<String> {
        validate_identifier(workspace_id, "workspace")?;
        validate_identifier(transaction_id, "transaction")?;
        let operation = SimulationOperation::parse(operation)?;
        if confirmation != confirmation_token(workspace_id, transaction_id, operation) {
            return Err(WorkspaceError::new(
                "CONFIRMATION_REQUIRED",
                "The exact dry-run confirmation token is required.",
            ));
        }

        let root = self.ensure_controlled_root()?;
        let workspace = root.join(workspace_id);
        let workspace_existed = path_entry_exists(&workspace)?;
        create_owned_directory(&root, &workspace)?;
        self.ensure_workspace_marker(&root, &workspace, workspace_id, !workspace_existed)?;
        let transactions = workspace.join(TRANSACTIONS_DIRECTORY);
        create_owned_directory(&root, &transactions)?;
        let transaction = transactions.join(transaction_id);
        if path_entry_exists(&transaction)? {
            return Err(WorkspaceError::new(
                "TRANSACTION_EXISTS",
                "The transaction identity has already been used.",
            ));
        }
        create_owned_directory(&root, &transaction)?;
        let journal = transaction.join(JOURNAL_DIRECTORY);
        let artifacts = transaction.join(ARTIFACTS_DIRECTORY);
        create_owned_directory(&root, &journal)?;
        create_owned_directory(&root, &artifacts)?;

        let manifest = expected_manifest(workspace_id, transaction_id, operation);
        publish_new_file(&root, &transaction, "manifest.json", manifest.as_bytes())?;

        let mut previous = None;
        for (sequence, from_state, to_state) in [
            (
                1,
                TransactionState::Proposed,
                TransactionState::AwaitingConfirmation,
            ),
            (
                2,
                TransactionState::AwaitingConfirmation,
                TransactionState::Ready,
            ),
            (3, TransactionState::Ready, TransactionState::Staging),
        ] {
            previous = Some(self.append_event(
                &root,
                &journal,
                transaction_id,
                sequence,
                from_state,
                to_state,
                "accepted",
                previous,
            )?);
        }
        Ok(status_json(
            transaction_id,
            TransactionState::Staging,
            3,
            previous.as_deref(),
        ))
    }

    pub fn simulate_commit(&self, workspace_id: &str, transaction_id: &str) -> Result<String> {
        let paths = self.existing_transaction(workspace_id, transaction_id)?;
        require_operation(paths.operation, SimulationOperation::Commit)?;
        let events = read_journal(&paths.root, &paths.journal, transaction_id)?;
        require_state(&events, TransactionState::Staging)?;
        let checksum4 = self.append_event(
            &paths.root,
            &paths.journal,
            transaction_id,
            4,
            TransactionState::Staging,
            TransactionState::Committing,
            "accepted",
            events.last().map(|event| event.checksum.clone()),
        )?;
        self.create_test_artifact(
            &paths.root,
            &paths.artifacts,
            transaction_id,
            paths.operation,
        )?;
        let checksum5 = self.append_event(
            &paths.root,
            &paths.journal,
            transaction_id,
            5,
            TransactionState::Committing,
            TransactionState::Committed,
            "accepted",
            Some(checksum4),
        )?;
        Ok(status_json(
            transaction_id,
            TransactionState::Committed,
            5,
            Some(&checksum5),
        ))
    }

    pub fn simulate_interruption(
        &self,
        workspace_id: &str,
        transaction_id: &str,
    ) -> Result<String> {
        let paths = self.existing_transaction(workspace_id, transaction_id)?;
        require_operation(paths.operation, SimulationOperation::Interruption)?;
        let events = read_journal(&paths.root, &paths.journal, transaction_id)?;
        require_state(&events, TransactionState::Staging)?;
        let checksum = self.append_event(
            &paths.root,
            &paths.journal,
            transaction_id,
            4,
            TransactionState::Staging,
            TransactionState::RecoveryRequired,
            "interrupted",
            events.last().map(|event| event.checksum.clone()),
        )?;
        self.create_test_artifact(
            &paths.root,
            &paths.artifacts,
            transaction_id,
            paths.operation,
        )?;
        Ok(status_json(
            transaction_id,
            TransactionState::RecoveryRequired,
            4,
            Some(&checksum),
        ))
    }

    pub fn recover(&self, workspace_id: &str, transaction_id: &str) -> Result<String> {
        let paths = self.existing_transaction(workspace_id, transaction_id)?;
        let events = read_journal(&paths.root, &paths.journal, transaction_id)?;
        let state = events.last().map(|event| event.to_state).ok_or_else(|| {
            WorkspaceError::new("JOURNAL_INVALID", "The transaction journal is empty.")
        })?;
        if state == TransactionState::RolledBack || state == TransactionState::Committed {
            let expected_operation = if state == TransactionState::Committed {
                SimulationOperation::Commit
            } else {
                SimulationOperation::Interruption
            };
            require_operation(paths.operation, expected_operation)?;
            let head = &events.last().expect("checked non-empty journal").checksum;
            return Ok(status_json(
                transaction_id,
                state,
                events.len() as u32,
                Some(head),
            ));
        }
        if state == TransactionState::Committing {
            require_operation(paths.operation, SimulationOperation::Commit)?;
            self.create_test_artifact(
                &paths.root,
                &paths.artifacts,
                transaction_id,
                paths.operation,
            )?;
            let sequence = events.len() as u32 + 1;
            let checksum = self.append_event(
                &paths.root,
                &paths.journal,
                transaction_id,
                sequence,
                TransactionState::Committing,
                TransactionState::Committed,
                "accepted",
                events.last().map(|event| event.checksum.clone()),
            )?;
            return Ok(status_json(
                transaction_id,
                TransactionState::Committed,
                sequence,
                Some(&checksum),
            ));
        }
        if state != TransactionState::RecoveryRequired && state != TransactionState::RollingBack {
            return Err(WorkspaceError::new(
                "RECOVERY_NOT_REQUIRED",
                "The journal does not identify a recoverable interrupted transaction.",
            ));
        }
        require_operation(paths.operation, SimulationOperation::Interruption)?;

        let mut sequence = events.len() as u32;
        let mut previous = events.last().map(|event| event.checksum.clone());
        if state == TransactionState::RecoveryRequired {
            sequence += 1;
            previous = Some(self.append_event(
                &paths.root,
                &paths.journal,
                transaction_id,
                sequence,
                TransactionState::RecoveryRequired,
                TransactionState::RollingBack,
                "accepted",
                previous,
            )?);
        }
        self.remove_owned_test_artifact(
            &paths.root,
            &paths.artifacts,
            transaction_id,
            paths.operation,
        )?;
        sequence += 1;
        let checksum = self.append_event(
            &paths.root,
            &paths.journal,
            transaction_id,
            sequence,
            TransactionState::RollingBack,
            TransactionState::RolledBack,
            "accepted",
            previous,
        )?;
        Ok(status_json(
            transaction_id,
            TransactionState::RolledBack,
            sequence,
            Some(&checksum),
        ))
    }

    pub fn rollback(&self, workspace_id: &str, transaction_id: &str) -> Result<String> {
        self.recover(workspace_id, transaction_id)
    }

    fn ensure_controlled_root(&self) -> Result<PathBuf> {
        ensure_directory_tree(&self.app_data_dir)?;
        reject_reparse_chain(&self.app_data_dir, &self.app_data_dir)?;
        let canonical_app_data = canonical_directory(&self.app_data_dir)?;
        let root = canonical_app_data.join(ROOT_DIRECTORY);
        let root_existed = path_entry_exists(&root)?;
        create_owned_directory(&canonical_app_data, &root)?;
        let canonical_root = canonical_directory(&root)?;
        if !canonical_root.starts_with(&canonical_app_data) || canonical_root == canonical_app_data
        {
            return Err(WorkspaceError::new(
                "CONTAINMENT_VIOLATION",
                "The controlled root escaped the application data boundary.",
            ));
        }
        let marker = canonical_root.join("controlled-root.json");
        let expected = format!(
            "{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"policyVersion\":\"{POLICY_VERSION}\",\"owner\":\"mcagentlauncher\"}}\n"
        );
        if root_existed {
            validate_existing_file(&canonical_root, &marker).map_err(|_| {
                WorkspaceError::new(
                    "ROOT_OWNERSHIP_INVALID",
                    "An existing controlled root has no valid ownership record.",
                )
            })?;
            if read_bounded(&canonical_root, &marker, 4096)? != expected {
                return Err(WorkspaceError::new(
                    "ROOT_OWNERSHIP_INVALID",
                    "The controlled root ownership record does not match.",
                ));
            }
        } else {
            publish_new_file(
                &canonical_root,
                &canonical_root,
                "controlled-root.json",
                expected.as_bytes(),
            )?;
        }
        Ok(canonical_root)
    }

    fn ensure_workspace_marker(
        &self,
        root: &Path,
        workspace: &Path,
        workspace_id: &str,
        allow_create: bool,
    ) -> Result<()> {
        let expected = format!("{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"workspaceId\":\"{workspace_id}\",\"policyVersion\":\"{POLICY_VERSION}\",\"owner\":\"mcagentlauncher\"}}\n");
        let marker = workspace.join("workspace.json");
        if path_entry_exists(&marker)? {
            validate_existing_file(root, &marker)?;
            if read_bounded(root, &marker, 4096)? != expected {
                return Err(WorkspaceError::new(
                    "WORKSPACE_OWNERSHIP_INVALID",
                    "The controlled workspace ownership record does not match.",
                ));
            }
            return Ok(());
        }
        if !allow_create {
            return Err(WorkspaceError::new(
                "WORKSPACE_OWNERSHIP_INVALID",
                "An existing workspace without an ownership record cannot be adopted.",
            ));
        }
        publish_new_file(root, workspace, "workspace.json", expected.as_bytes())
    }

    fn existing_transaction(
        &self,
        workspace_id: &str,
        transaction_id: &str,
    ) -> Result<TransactionPaths> {
        validate_identifier(workspace_id, "workspace")?;
        validate_identifier(transaction_id, "transaction")?;
        let root = self.ensure_controlled_root()?;
        let workspace = root.join(workspace_id);
        validate_existing_directory(&root, &workspace)?;
        self.ensure_workspace_marker(&root, &workspace, workspace_id, false)?;
        let transaction = workspace.join(TRANSACTIONS_DIRECTORY).join(transaction_id);
        validate_existing_directory(&root, &transaction)?;
        let journal = transaction.join(JOURNAL_DIRECTORY);
        let artifacts = transaction.join(ARTIFACTS_DIRECTORY);
        validate_existing_directory(&root, &journal)?;
        validate_existing_directory(&root, &artifacts)?;
        let manifest_path = transaction.join("manifest.json");
        validate_existing_file(&root, &manifest_path)?;
        let manifest = read_bounded(&root, &manifest_path, 16_384)?;
        let operation = [
            SimulationOperation::Commit,
            SimulationOperation::Interruption,
        ]
        .into_iter()
        .find(|operation| manifest == expected_manifest(workspace_id, transaction_id, *operation))
        .ok_or_else(|| {
            WorkspaceError::new(
                "MANIFEST_INVALID",
                "The versioned manifest binding or checksum is invalid.",
            )
        })?;
        Ok(TransactionPaths {
            root,
            journal,
            artifacts,
            operation,
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn append_event(
        &self,
        root: &Path,
        journal: &Path,
        transaction_id: &str,
        sequence: u32,
        from_state: TransactionState,
        to_state: TransactionState,
        result: &'static str,
        previous: Option<String>,
    ) -> Result<String> {
        if !allowed_transition(from_state, to_state) {
            return Err(WorkspaceError::new(
                "STATE_TRANSITION_INVALID",
                "The requested transaction transition is invalid.",
            ));
        }
        let event = JournalEvent::new(
            sequence,
            transaction_id,
            from_state,
            to_state,
            result,
            previous,
        );
        let filename = format!("{sequence:08}.json");
        publish_new_file(root, journal, &filename, event.render().as_bytes())?;
        Ok(event.checksum)
    }

    fn create_test_artifact(
        &self,
        root: &Path,
        artifacts: &Path,
        transaction_id: &str,
        operation: SimulationOperation,
    ) -> Result<()> {
        validate_artifact_directory(root, artifacts)?;
        let payload = artifact_payload(transaction_id, operation);
        let artifact = artifacts.join(ARTIFACT_FILE);
        if path_entry_exists(&artifact)? {
            validate_existing_file(root, &artifact)?;
            if read_bounded(root, &artifact, 4096)? == payload {
                return Ok(());
            }
            return Err(WorkspaceError::new(
                "ARTIFACT_OWNERSHIP_INVALID",
                "The simulation artifact is not owned by this transaction.",
            ));
        }
        publish_new_file(root, artifacts, ARTIFACT_FILE, payload.as_bytes())
    }

    fn remove_owned_test_artifact(
        &self,
        root: &Path,
        artifacts: &Path,
        transaction_id: &str,
        operation: SimulationOperation,
    ) -> Result<()> {
        validate_artifact_directory(root, artifacts)?;
        let artifact = artifacts.join(ARTIFACT_FILE);
        if !path_entry_exists(&artifact)? {
            return Ok(());
        }
        validate_existing_file(root, &artifact)?;
        if read_bounded(root, &artifact, 4096)? != artifact_payload(transaction_id, operation) {
            return Err(WorkspaceError::new("ROLLBACK_OWNERSHIP_INVALID", "Rollback refused to remove an artifact without exact current-transaction ownership evidence."));
        }
        validate_existing_file(root, &artifact)?;
        fs::remove_file(&artifact).map_err(|_| {
            WorkspaceError::new(
                "ROLLBACK_FAILED",
                "The owned test artifact could not be removed.",
            )
        })
    }
}

struct TransactionPaths {
    root: PathBuf,
    journal: PathBuf,
    artifacts: PathBuf,
    operation: SimulationOperation,
}

fn confirmation_token(
    workspace_id: &str,
    transaction_id: &str,
    operation: SimulationOperation,
) -> String {
    let binding = format!(
        "{SCHEMA_VERSION}\n{POLICY_VERSION}\napp-managed\n{workspace_id}\n{transaction_id}\n{}\ncontrolled-workspace-test-only\n",
        operation.as_str(),
    );
    format!("confirm:{}", sha256_hex(binding.as_bytes()))
}

fn artifact_payload(transaction_id: &str, operation: SimulationOperation) -> String {
    format!("{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"artifactId\":\"simulation-marker\",\"createdByTransaction\":\"{transaction_id}\",\"simulationOperation\":\"{}\",\"purpose\":\"controlled-workspace-test-only\"}}\n", operation.as_str())
}

fn expected_manifest(
    workspace_id: &str,
    transaction_id: &str,
    operation: SimulationOperation,
) -> String {
    let artifact_relative =
        format!("{TRANSACTIONS_DIRECTORY}/{transaction_id}/{ARTIFACTS_DIRECTORY}/{ARTIFACT_FILE}");
    let payload = format!(
        "{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"manifestId\":\"manifest-{transaction_id}\",\"transactionId\":\"{transaction_id}\",\"workspaceId\":\"{workspace_id}\",\"policyVersion\":\"{POLICY_VERSION}\",\"kind\":\"controlled-workspace-simulation\",\"simulationOperation\":\"{}\",\"artifacts\":[{{\"artifactId\":\"simulation-marker\",\"relativePath\":\"{artifact_relative}\",\"createdByTransaction\":\"{transaction_id}\",\"rollback\":\"remove-owned\"}}]}}",
        operation.as_str(),
    );
    format!(
        "{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"payload\":{payload},\"payloadChecksum\":\"{}\"}}\n",
        sha256_hex(payload.as_bytes())
    )
}

fn status_json(
    transaction_id: &str,
    state: TransactionState,
    sequence: u32,
    checksum: Option<&str>,
) -> String {
    let checksum_json = checksum
        .map(|value| format!("\"{value}\""))
        .unwrap_or_else(|| "null".to_owned());
    format!("{{\"schemaVersion\":\"{SCHEMA_VERSION}\",\"transactionId\":\"{transaction_id}\",\"state\":\"{}\",\"journalSequence\":{sequence},\"journalHeadChecksum\":{checksum_json}}}", state.as_str())
}

fn validate_identifier(value: &str, kind: &str) -> Result<()> {
    let valid = (6..=64).contains(&value.len())
        && value.as_bytes()[0].is_ascii_lowercase()
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'_'
        });
    if !valid || value == ".minecraft" || value.contains("minecraft") {
        return Err(WorkspaceError::new("IDENTIFIER_INVALID", format!("The {kind} identity must be a lowercase opaque identifier and cannot name a Minecraft location.")));
    }
    Ok(())
}

fn ensure_directory_tree(path: &Path) -> Result<()> {
    if path_entry_exists(path)? {
        return validate_existing_directory(path, path);
    }
    let parent = path.parent().ok_or_else(|| {
        WorkspaceError::new(
            "APP_DATA_INVALID",
            "The application data boundary has no parent.",
        )
    })?;
    ensure_directory_tree(parent)?;
    reject_reparse_chain(parent, parent)?;
    fs::create_dir(path).map_err(|_| {
        WorkspaceError::new(
            "WORKSPACE_CREATE_FAILED",
            "An application-owned directory could not be created.",
        )
    })?;
    validate_existing_directory(parent, path)
}

fn create_owned_directory(root: &Path, path: &Path) -> Result<()> {
    validate_lexical_child(root, path)?;
    if path_entry_exists(path)? {
        return validate_existing_directory(root, path);
    }
    let parent = path.parent().ok_or_else(|| {
        WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "The target has no controlled parent.",
        )
    })?;
    validate_existing_directory(root, parent)?;
    fs::create_dir(path).map_err(|_| {
        WorkspaceError::new(
            "WORKSPACE_CREATE_FAILED",
            "A controlled directory could not be created.",
        )
    })?;
    validate_existing_directory(root, path)
}

fn path_entry_exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err(WorkspaceError::new(
            "PATH_INSPECTION_FAILED",
            "A controlled path entry could not be inspected.",
        )),
    }
}

fn validate_lexical_child(root: &Path, path: &Path) -> Result<()> {
    if !root.is_absolute() || !path.is_absolute() || !path.starts_with(root) || path == root {
        return Err(WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "The target is outside the controlled workspace.",
        ));
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
    {
        return Err(WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "Traversal components are forbidden.",
        ));
    }
    Ok(())
}

fn validate_existing_directory(root: &Path, path: &Path) -> Result<()> {
    if root != path {
        validate_lexical_child(root, path)?;
    }
    reject_reparse_chain(root, path)?;
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        WorkspaceError::new(
            "WORKSPACE_NOT_FOUND",
            "A controlled directory does not exist.",
        )
    })?;
    if !metadata.is_dir() || is_reparse_or_symlink(&metadata) {
        return Err(WorkspaceError::new(
            "REPARSE_POINT_REJECTED",
            "Symlinks, junctions, and reparse points are forbidden.",
        ));
    }
    let canonical_root = canonical_directory(root)?;
    let canonical_path = canonical_directory(path)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "Canonical containment validation failed.",
        ));
    }
    Ok(())
}

fn validate_existing_file(root: &Path, path: &Path) -> Result<()> {
    validate_lexical_child(root, path)?;
    let parent = path.parent().ok_or_else(|| {
        WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "The file has no controlled parent.",
        )
    })?;
    validate_existing_directory(root, parent)?;
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        WorkspaceError::new(
            "FILE_NOT_FOUND",
            "A required controlled file does not exist.",
        )
    })?;
    if !metadata.is_file() || is_reparse_or_symlink(&metadata) {
        return Err(WorkspaceError::new(
            "REPARSE_POINT_REJECTED",
            "Controlled records must be regular files, never links or reparse points.",
        ));
    }
    Ok(())
}

fn reject_reparse_chain(root: &Path, target: &Path) -> Result<()> {
    if target != root && !target.starts_with(root) {
        return Err(WorkspaceError::new(
            "CONTAINMENT_VIOLATION",
            "The target is outside the validation root.",
        ));
    }
    let mut current = root.to_path_buf();
    check_not_reparse(&current)?;
    if target != root {
        let relative = target.strip_prefix(root).map_err(|_| {
            WorkspaceError::new(
                "CONTAINMENT_VIOLATION",
                "The target is outside the validation root.",
            )
        })?;
        for component in relative.components() {
            current.push(component.as_os_str());
            if path_entry_exists(&current)? {
                check_not_reparse(&current)?;
            }
        }
    }
    Ok(())
}

fn check_not_reparse(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        WorkspaceError::new(
            "PATH_INSPECTION_FAILED",
            "A controlled path component could not be inspected.",
        )
    })?;
    if is_reparse_or_symlink(&metadata) {
        return Err(WorkspaceError::new(
            "REPARSE_POINT_REJECTED",
            "Symlinks, junctions, and Windows reparse points are forbidden.",
        ));
    }
    Ok(())
}

fn is_reparse_or_symlink(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    false
}

fn canonical_directory(path: &Path) -> Result<PathBuf> {
    path.canonicalize().map_err(|_| {
        WorkspaceError::new(
            "CANONICALIZATION_FAILED",
            "A controlled directory could not be canonicalized.",
        )
    })
}

fn publish_new_file(root: &Path, directory: &Path, filename: &str, contents: &[u8]) -> Result<()> {
    validate_existing_directory(root, directory)?;
    if filename.contains(['/', '\\']) || filename == "." || filename == ".." {
        return Err(WorkspaceError::new(
            "FILENAME_INVALID",
            "Controlled record names must be fixed leaf names.",
        ));
    }
    let target = directory.join(filename);
    validate_lexical_child(root, &target)?;
    if path_entry_exists(&target)? {
        return Err(WorkspaceError::new(
            "RECORD_EXISTS",
            "An immutable controlled record already exists.",
        ));
    }
    let pending = directory.join(format!(".{filename}.pending"));
    validate_lexical_child(root, &pending)?;
    if path_entry_exists(&pending)? {
        validate_existing_file(root, &pending)?;
        return Err(WorkspaceError::new(
            "RECOVERY_REQUIRED",
            "An unpublished transaction record requires recovery.",
        ));
    }
    validate_existing_directory(root, directory)?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&pending)
        .map_err(|_| {
            WorkspaceError::new(
                "PERSIST_FAILED",
                "A temporary controlled record could not be created.",
            )
        })?;
    file.write_all(contents)
        .and_then(|_| file.sync_all())
        .map_err(|_| {
            WorkspaceError::new(
                "PERSIST_FAILED",
                "A controlled record could not be synchronized.",
            )
        })?;
    drop(file);
    validate_existing_file(root, &pending)?;
    validate_existing_directory(root, directory)?;
    validate_existing_file(root, &pending)?;
    if path_entry_exists(&target)? {
        return Err(WorkspaceError::new(
            "RECORD_EXISTS",
            "An immutable controlled record appeared before publication.",
        ));
    }
    fs::rename(&pending, &target).map_err(|_| {
        WorkspaceError::new(
            "PUBLISH_FAILED",
            "A controlled record could not be atomically published.",
        )
    })?;
    validate_existing_file(root, &target)
}

fn read_bounded(root: &Path, path: &Path, maximum: u64) -> Result<String> {
    validate_existing_file(root, path)?;
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        WorkspaceError::new("READ_FAILED", "A controlled record could not be inspected.")
    })?;
    if metadata.len() > maximum {
        return Err(WorkspaceError::new(
            "RECORD_TOO_LARGE",
            "A controlled record exceeds its fixed size limit.",
        ));
    }
    validate_existing_file(root, path)?;
    let mut value = String::new();
    File::open(path)
        .and_then(|mut file| file.read_to_string(&mut value))
        .map_err(|_| {
            WorkspaceError::new("READ_FAILED", "A controlled record could not be read.")
        })?;
    Ok(value)
}

fn read_journal(root: &Path, journal: &Path, transaction_id: &str) -> Result<Vec<JournalEvent>> {
    validate_existing_directory(root, journal)?;
    let mut paths = Vec::new();
    for entry in fs::read_dir(journal).map_err(|_| {
        WorkspaceError::new(
            "JOURNAL_INVALID",
            "The transaction journal could not be listed.",
        )
    })? {
        let entry = entry.map_err(|_| {
            WorkspaceError::new("JOURNAL_INVALID", "A journal entry could not be inspected.")
        })?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && name.ends_with(".pending") {
            return Err(WorkspaceError::new(
                "RECOVERY_REQUIRED",
                "The journal contains an unpublished record.",
            ));
        }
        if name.len() != 13
            || !name.ends_with(".json")
            || !name[..8].bytes().all(|byte| byte.is_ascii_digit())
        {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal contains an unexpected record.",
            ));
        }
        paths.push(entry.path());
    }
    paths.sort();
    let mut events: Vec<JournalEvent> = Vec::with_capacity(paths.len());
    for (index, path) in paths.iter().enumerate() {
        validate_existing_file(root, path)?;
        let event = JournalEvent::parse(&read_bounded(root, path, 8192)?)?;
        if event.sequence != index as u32 + 1 || event.transaction_id != transaction_id {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal sequence or transaction binding is invalid.",
            ));
        }
        if let Some(previous) = events.last() {
            if event.previous_checksum.as_deref() != Some(previous.checksum.as_str())
                || event.from_state != previous.to_state
            {
                return Err(WorkspaceError::new(
                    "JOURNAL_INVALID",
                    "The journal state or checksum chain is broken.",
                ));
            }
        } else if event.previous_checksum.is_some()
            || event.from_state != TransactionState::Proposed
        {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The first journal event is invalid.",
            ));
        }
        if !allowed_transition(event.from_state, event.to_state) {
            return Err(WorkspaceError::new(
                "JOURNAL_INVALID",
                "The journal contains an invalid state transition.",
            ));
        }
        events.push(event);
    }
    Ok(events)
}

fn require_state(events: &[JournalEvent], required: TransactionState) -> Result<()> {
    if events.last().map(|event| event.to_state) != Some(required) {
        return Err(WorkspaceError::new(
            "STATE_MISMATCH",
            "The transaction is not in the required state.",
        ));
    }
    Ok(())
}

fn require_operation(actual: SimulationOperation, required: SimulationOperation) -> Result<()> {
    if actual != required {
        return Err(WorkspaceError::new(
            "OPERATION_MISMATCH",
            "The command does not match the exact simulation operation confirmed in the manifest.",
        ));
    }
    Ok(())
}

fn validate_artifact_directory(root: &Path, artifacts: &Path) -> Result<()> {
    validate_existing_directory(root, artifacts)?;
    for entry in fs::read_dir(artifacts).map_err(|_| {
        WorkspaceError::new(
            "ARTIFACT_DIRECTORY_INVALID",
            "The transaction artifact directory could not be inspected.",
        )
    })? {
        let entry = entry.map_err(|_| {
            WorkspaceError::new(
                "ARTIFACT_DIRECTORY_INVALID",
                "A transaction artifact entry could not be inspected.",
            )
        })?;
        if entry.file_name() != std::ffi::OsStr::new(ARTIFACT_FILE) {
            return Err(WorkspaceError::new(
                "UNKNOWN_ARTIFACT",
                "The transaction contains an unknown artifact; mutation and rollback are refused.",
            ));
        }
        validate_existing_file(root, &entry.path())?;
    }
    Ok(())
}

fn allowed_transition(from: TransactionState, to: TransactionState) -> bool {
    matches!(
        (from, to),
        (
            TransactionState::Proposed,
            TransactionState::AwaitingConfirmation
        ) | (
            TransactionState::AwaitingConfirmation,
            TransactionState::Ready
        ) | (TransactionState::Ready, TransactionState::Staging)
            | (TransactionState::Staging, TransactionState::Committing)
            | (TransactionState::Committing, TransactionState::Committed)
            | (
                TransactionState::Staging,
                TransactionState::RecoveryRequired
            )
            | (
                TransactionState::RecoveryRequired,
                TransactionState::RollingBack
            )
            | (TransactionState::RollingBack, TransactionState::RolledBack)
    )
}

fn journal_checksum_payload(
    sequence: u32,
    transaction_id: &str,
    from_state: TransactionState,
    to_state: TransactionState,
    result: &str,
    previous_checksum: Option<&str>,
) -> String {
    format!(
        "{SCHEMA_VERSION}\n{sequence}\n{transaction_id}\n{}\n{}\n{result}\n{}\n",
        from_state.as_str(),
        to_state.as_str(),
        previous_checksum.unwrap_or("-")
    )
}

fn json_string(text: &str, key: &str) -> Result<String> {
    let prefix = format!("\"{key}\":\"");
    let start = text.find(&prefix).ok_or_else(|| {
        WorkspaceError::new("JOURNAL_INVALID", "A required journal field is missing.")
    })? + prefix.len();
    let tail = &text[start..];
    let end = tail.find('"').ok_or_else(|| {
        WorkspaceError::new("JOURNAL_INVALID", "A journal string is unterminated.")
    })?;
    let value = &tail[..end];
    if value.contains(['\\', '\n', '\r']) {
        return Err(WorkspaceError::new(
            "JOURNAL_INVALID",
            "Escaped journal strings are not accepted.",
        ));
    }
    Ok(value.to_owned())
}

fn json_nullable_string(text: &str, key: &str) -> Result<Option<String>> {
    let quoted = format!("\"{key}\":\"");
    if text.contains(&quoted) {
        return json_string(text, key).map(Some);
    }
    let null_value = format!("\"{key}\":null");
    if text.contains(&null_value) {
        return Ok(None);
    }
    Err(WorkspaceError::new(
        "JOURNAL_INVALID",
        "A nullable journal field is malformed.",
    ))
}

fn json_u32(text: &str, key: &str) -> Result<u32> {
    let prefix = format!("\"{key}\":");
    let start = text.find(&prefix).ok_or_else(|| {
        WorkspaceError::new(
            "JOURNAL_INVALID",
            "A required numeric journal field is missing.",
        )
    })? + prefix.len();
    let digits: String = text[start..]
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();
    if digits.is_empty() || (digits.starts_with('0') && digits.len() > 1) {
        return Err(WorkspaceError::new(
            "JOURNAL_INVALID",
            "A journal number is malformed.",
        ));
    }
    digits
        .parse()
        .map_err(|_| WorkspaceError::new("JOURNAL_INVALID", "A journal number is out of range."))
}

fn is_lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn sha256_hex(input: &[u8]) -> String {
    const INITIAL: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let bit_length = (input.len() as u64) * 8;
    let mut padded = input.to_vec();
    padded.push(0x80);
    while padded.len() % 64 != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_length.to_be_bytes());
    let mut hash = INITIAL;
    for chunk in padded.chunks_exact(64) {
        let mut words = [0u32; 64];
        for (index, word) in words.iter_mut().take(16).enumerate() {
            let offset = index * 4;
            *word = u32::from_be_bytes(
                chunk[offset..offset + 4]
                    .try_into()
                    .expect("four-byte chunk"),
            );
        }
        for index in 16..64 {
            let s0 = words[index - 15].rotate_right(7)
                ^ words[index - 15].rotate_right(18)
                ^ (words[index - 15] >> 3);
            let s1 = words[index - 2].rotate_right(17)
                ^ words[index - 2].rotate_right(19)
                ^ (words[index - 2] >> 10);
            words[index] = words[index - 16]
                .wrapping_add(s0)
                .wrapping_add(words[index - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = hash;
        for index in 0..64 {
            let sum1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let choice = (e & f) ^ ((!e) & g);
            let temporary1 = h
                .wrapping_add(sum1)
                .wrapping_add(choice)
                .wrapping_add(K[index])
                .wrapping_add(words[index]);
            let sum0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let majority = (a & b) ^ (a & c) ^ (b & c);
            let temporary2 = sum0.wrapping_add(majority);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(temporary1);
            d = c;
            c = b;
            b = a;
            a = temporary1.wrapping_add(temporary2);
        }
        hash = [
            hash[0].wrapping_add(a),
            hash[1].wrapping_add(b),
            hash[2].wrapping_add(c),
            hash[3].wrapping_add(d),
            hash[4].wrapping_add(e),
            hash[5].wrapping_add(f),
            hash[6].wrapping_add(g),
            hash[7].wrapping_add(h),
        ];
    }
    hash.iter().map(|word| format!("{word:08x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::panic::{catch_unwind, AssertUnwindSafe};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEST: AtomicU64 = AtomicU64::new(1);

    struct TestBoundary {
        path: PathBuf,
        executor: ControlledWorkspace,
    }

    impl TestBoundary {
        fn new() -> Self {
            Self::at(next_test_path())
        }

        fn at(path: PathBuf) -> Self {
            fs::create_dir(&path).expect("create isolated test app-data boundary");
            Self {
                executor: ControlledWorkspace::for_test(path.clone()),
                path,
            }
        }
    }

    impl Drop for TestBoundary {
        fn drop(&mut self) {
            let expected_prefix = format!(
                "mcagentlauncher-controlled-workspace-test-{}-",
                std::process::id()
            );
            let is_owned_test_boundary = self
                .path
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.starts_with(&expected_prefix));
            if is_owned_test_boundary && self.path.is_dir() {
                let _ = fs::remove_dir_all(&self.path);
            }
        }
    }

    fn next_test_path() -> PathBuf {
        std::env::temp_dir().join(format!(
            "mcagentlauncher-controlled-workspace-test-{}-{}",
            std::process::id(),
            NEXT_TEST.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn sha256_matches_known_answer() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn preview_is_side_effect_free_and_requires_opaque_ids() {
        let missing = std::env::temp_dir().join(format!(
            "mcagentlauncher-controlled-workspace-test-{}-missing",
            std::process::id()
        ));
        let executor = ControlledWorkspace::for_test(missing.clone());
        let preview = executor
            .preview("workspace_01", "transaction_01", "commit")
            .expect("preview");
        assert!(preview.contains("\"mode\":\"dry-run\""));
        assert!(preview.contains("\"simulationOperation\":\"commit\""));
        assert!(!missing.exists());
        for invalid in [
            "../escape",
            "..\\escape",
            "safe/../escape",
            "safe\\..\\escape",
            "/absolute",
            "c:\\escape",
            "mixed/\\escape",
            "minecraft-home",
        ] {
            assert!(executor
                .preview(invalid, "transaction_01", "commit")
                .is_err());
        }
        assert!(executor
            .preview("workspace_01", "transaction_01", "unknown")
            .is_err());
    }

    #[test]
    fn confirmation_binds_preview_operation_workspace_and_unique_transaction() {
        let boundary = TestBoundary::new();
        let commit_token = confirmation_token(
            "workspace_01",
            "transaction_01",
            SimulationOperation::Commit,
        );
        let interruption_token = confirmation_token(
            "workspace_01",
            "transaction_01",
            SimulationOperation::Interruption,
        );
        assert_ne!(commit_token, interruption_token);
        assert!(boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_01",
                "interruption",
                &commit_token
            )
            .is_err());
        assert!(boundary
            .executor
            .confirm_and_begin("workspace_02", "transaction_01", "commit", &commit_token)
            .is_err());
        assert!(boundary
            .executor
            .confirm_and_begin("workspace_01", "transaction_02", "commit", &commit_token)
            .is_err());
        let status = boundary
            .executor
            .confirm_and_begin("workspace_01", "transaction_01", "commit", &commit_token)
            .expect("confirmed begin");
        assert!(status.contains("\"state\":\"staging\""));
        assert!(boundary
            .executor
            .confirm_and_begin("workspace_01", "transaction_01", "commit", &commit_token)
            .is_err());
        let root = boundary
            .path
            .join(ROOT_DIRECTORY)
            .canonicalize()
            .expect("root");
        let transaction = root
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_01");
        assert!(
            read_bounded(&root, &transaction.join("manifest.json"), 8192)
                .expect("manifest")
                .contains("\"simulationOperation\":\"commit\"")
        );
        assert_eq!(
            fs::read_dir(transaction.join(JOURNAL_DIRECTORY))
                .expect("journal")
                .count(),
            3
        );
    }

    #[test]
    fn commit_and_interruption_recovery_are_deterministic_and_idempotent() {
        let boundary = TestBoundary::new();
        boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_commit",
                "commit",
                &confirmation_token(
                    "workspace_01",
                    "transaction_commit",
                    SimulationOperation::Commit,
                ),
            )
            .expect("begin commit");
        boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_interrupt",
                "interruption",
                &confirmation_token(
                    "workspace_01",
                    "transaction_interrupt",
                    SimulationOperation::Interruption,
                ),
            )
            .expect("begin interruption");
        assert!(boundary
            .executor
            .simulate_interruption("workspace_01", "transaction_commit")
            .is_err());
        assert!(boundary
            .executor
            .simulate_commit("workspace_01", "transaction_interrupt")
            .is_err());
        let committed = boundary
            .executor
            .simulate_commit("workspace_01", "transaction_commit")
            .expect("commit");
        assert!(committed.contains("\"state\":\"committed\""));
        assert!(boundary
            .executor
            .recover("workspace_01", "transaction_commit")
            .expect("committed recovery no-op")
            .contains("\"state\":\"committed\""));

        boundary
            .executor
            .simulate_interruption("workspace_01", "transaction_interrupt")
            .expect("interrupt");
        let rolled_back = boundary
            .executor
            .recover("workspace_01", "transaction_interrupt")
            .expect("recover");
        assert!(rolled_back.contains("\"state\":\"rolled_back\""));
        assert!(boundary
            .executor
            .rollback("workspace_01", "transaction_interrupt")
            .expect("idempotent rollback")
            .contains("\"state\":\"rolled_back\""));
        let artifact = boundary
            .path
            .join(ROOT_DIRECTORY)
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_interrupt")
            .join(ARTIFACTS_DIRECTORY)
            .join(ARTIFACT_FILE);
        assert!(!artifact.exists());
        let committed_artifact = boundary
            .path
            .join(ROOT_DIRECTORY)
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_commit")
            .join(ARTIFACTS_DIRECTORY)
            .join(ARTIFACT_FILE);
        assert!(
            committed_artifact.exists(),
            "rollback must not touch a sibling transaction"
        );
    }

    #[test]
    fn corrupt_or_gapped_journal_fails_closed() {
        let boundary = TestBoundary::new();
        boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_01",
                "commit",
                &confirmation_token(
                    "workspace_01",
                    "transaction_01",
                    SimulationOperation::Commit,
                ),
            )
            .expect("begin");
        let journal = boundary
            .path
            .join(ROOT_DIRECTORY)
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_01")
            .join(JOURNAL_DIRECTORY);
        fs::rename(journal.join("00000003.json"), journal.join("00000004.json"))
            .expect("create journal gap");
        assert!(boundary
            .executor
            .simulate_commit("workspace_01", "transaction_01")
            .is_err());
    }

    #[test]
    fn corrupt_manifest_and_unmarked_existing_workspace_fail_closed() {
        let boundary = TestBoundary::new();
        let root = boundary
            .executor
            .ensure_controlled_root()
            .expect("controlled root");
        fs::create_dir(root.join("unmarked_01")).expect("unmarked workspace");
        assert!(boundary
            .executor
            .confirm_and_begin(
                "unmarked_01",
                "transaction_01",
                "commit",
                &confirmation_token("unmarked_01", "transaction_01", SimulationOperation::Commit)
            )
            .is_err());

        boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_02",
                "commit",
                &confirmation_token(
                    "workspace_01",
                    "transaction_02",
                    SimulationOperation::Commit,
                ),
            )
            .expect("begin");
        let manifest = root
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_02")
            .join("manifest.json");
        fs::write(&manifest, b"{}\n").expect("corrupt manifest");
        assert!(boundary
            .executor
            .simulate_commit("workspace_01", "transaction_02")
            .is_err());
    }

    #[test]
    fn rollback_refuses_unknown_artifacts() {
        let boundary = TestBoundary::new();
        boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_01",
                "interruption",
                &confirmation_token(
                    "workspace_01",
                    "transaction_01",
                    SimulationOperation::Interruption,
                ),
            )
            .expect("begin");
        boundary
            .executor
            .simulate_interruption("workspace_01", "transaction_01")
            .expect("interrupt");
        let unknown = boundary
            .path
            .join(ROOT_DIRECTORY)
            .join("workspace_01")
            .join(TRANSACTIONS_DIRECTORY)
            .join("transaction_01")
            .join(ARTIFACTS_DIRECTORY)
            .join("unknown.bin");
        fs::write(&unknown, b"unknown").expect("unknown artifact");
        assert!(boundary
            .executor
            .recover("workspace_01", "transaction_01")
            .is_err());
        assert!(unknown.exists());
    }

    #[test]
    fn test_boundary_cleanup_runs_during_unwind() {
        let path = next_test_path();
        let unwind_path = path.clone();
        let result = catch_unwind(AssertUnwindSafe(move || {
            let _boundary = TestBoundary::at(unwind_path);
            panic!("intentional cleanup test");
        }));
        assert!(result.is_err());
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_is_rejected() {
        use std::os::unix::fs::symlink;
        let boundary = TestBoundary::new();
        let outside = boundary.path.join("outside");
        fs::create_dir(&outside).expect("outside");
        let root = boundary
            .executor
            .ensure_controlled_root()
            .expect("controlled root");
        symlink(&outside, root.join("workspace_01")).expect("symlink");
        assert!(boundary
            .executor
            .confirm_and_begin(
                "workspace_01",
                "transaction_01",
                "commit",
                &confirmation_token(
                    "workspace_01",
                    "transaction_01",
                    SimulationOperation::Commit
                )
            )
            .is_err());
    }

    #[cfg(windows)]
    #[test]
    fn windows_directory_symlink_or_reparse_metadata_is_rejected() {
        use std::os::windows::fs::{symlink_dir, MetadataExt};
        let boundary = TestBoundary::new();
        let metadata = fs::symlink_metadata(&boundary.path).expect("metadata");
        assert_eq!(
            is_reparse_or_symlink(&metadata),
            metadata.file_attributes() & 0x0400 != 0
        );
        let root = boundary
            .executor
            .ensure_controlled_root()
            .expect("controlled root");
        let outside = boundary.path.join("outside");
        fs::create_dir(&outside).expect("outside");
        fs::write(outside.join("canary.txt"), b"preserve").expect("canary");
        let link = root.join("workspace_01");
        if symlink_dir(&outside, &link).is_ok() {
            assert!(boundary
                .executor
                .confirm_and_begin(
                    "workspace_01",
                    "transaction_01",
                    "commit",
                    &confirmation_token(
                        "workspace_01",
                        "transaction_01",
                        SimulationOperation::Commit
                    )
                )
                .is_err());
            fs::remove_dir(&link).expect("remove link only");
            assert_eq!(
                fs::read(outside.join("canary.txt")).expect("canary"),
                b"preserve"
            );
        }
    }
}
