from __future__ import annotations

from typing import Any


def explain_plan(payload: dict[str, Any]) -> dict[str, list[str] | str]:
    plan = payload.get("plan", payload)
    diagnostics = payload.get("diagnostics", {})
    resources = plan.get("resources", [])
    names = [item.get("project", {}).get("name", "未知资源") for item in resources]
    target = plan.get("target", {})
    warnings = plan.get("ruleResults", {}).get("warnings", [])
    network_used = diagnostics.get("networkUsed", False)

    summary = (
        f"这是一个面向 Minecraft {target.get('minecraftVersion', '未知版本')} "
        f"{target.get('loader', 'fabric')} 的 v0.1 离线资源规划，包含 {len(resources)} 个推荐资源。"
    )

    details = [
        f"推荐资源：{', '.join(names)}。" if names else "当前方案没有推荐资源。",
        "这些资源由 MCAgent Server 的 pipeline-compatible offline adapter 生成，用于验证 intent -> alias -> resolver query -> resource-plan 的数据链路。",
        "当前没有进行真实 Modrinth 查询；资源版本、hash、许可证和兼容性仍需要后续 Resource Resolver 阶段确认。",
        "MCAgent Server 只生成可审核方案，不下载资源、不安装资源、不写入本地实例。",
    ]

    if warnings:
        details.append(f"当前方案包含 {len(warnings)} 条 warning，主要表示离线 mock resolver 和待校验元数据。")

    explanation_warnings = [
        "当前是 mock/offline pipeline 输出，不能直接作为最终安装依据。",
        "所有安装动作仍必须由 Desktop Local Executor 在用户确认后执行。",
    ]
    if network_used:
        explanation_warnings.append("diagnostics 显示发生过网络查询；请确认该行为只在显式允许时发生。")
    else:
        explanation_warnings.append("diagnostics.networkUsed=false，本次解释的方案未进行真实网络查询。")

    for warning in warnings[:5]:
        message = warning.get("message")
        if isinstance(message, str):
            explanation_warnings.append(message)

    return {
        "summary": summary,
        "details": details,
        "warnings": explanation_warnings,
    }
