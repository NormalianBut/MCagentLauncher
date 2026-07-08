from __future__ import annotations


def explain_plan(plan: dict) -> dict[str, list[str] | str]:
    resources = plan.get("resources", [])
    names = [item.get("project", {}).get("name", "未知资源") for item in resources]
    target = plan.get("target", {})

    summary = (
        f"这是一个面向 Minecraft {target.get('minecraftVersion', '未知版本')} "
        f"{target.get('loader', 'fabric')} 的 v0.1 mock 资源方案，包含 {len(resources)} 个推荐资源。"
    )

    details = [
        f"推荐资源：{', '.join(names)}。" if names else "当前方案没有推荐资源。",
        "这些资源来自 mock 规则映射，用于验证 intent -> plan -> explain 的接口链路。",
        "真正安装前仍需要 Resource Resolver 查询真实元数据、版本兼容性和 hash。",
    ]

    warnings = [
        "v0.1 mock plan 尚未经过真实资源 API 解析，不能直接作为最终安装依据。",
        "MCAgent mock server 不下载资源、不写入本地实例、不执行本地文件操作。",
    ]

    return {
        "summary": summary,
        "details": details,
        "warnings": warnings,
    }

