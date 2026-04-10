
# ─────────────────────────────────────────────────────────────────────────────
# PASTE THIS AT THE VERY BOTTOM OF main.py IN GITHUB, THEN COMMIT
# Also update the "from typing import Optional" line to add: List, Dict, Any
# And add "from pydantic import BaseModel" after the existing imports if missing
# ─────────────────────────────────────────────────────────────────────────────


# ── Plan Chat (no auth required) ─────────────────────────────────────────────

class PlanChatMessage(BaseModel):
    role: str
    content: str

class PlanChatRequest(BaseModel):
    messages: List[PlanChatMessage] = []
    stats: Dict[str, Any] = {}
    goals: List[str] = []
    action: str = "chat"   # "chat" | "generate" | "modify"
    current_plan: Any = None


@app.post("/plan-chat", tags=["Plan"])
async def plan_chat(payload: PlanChatRequest):
    """AI health coach — no auth required. Chat or generate a plan."""

    if payload.action in ("generate", "modify"):
        week_start = str(date.today())
        prompt = build_schedule_prompt(
            stats=payload.stats,
            goals=payload.goals,
            bloodwork=None,
            week_start=week_start,
        )
        if payload.action == "modify" and payload.current_plan:
            prompt += (
                "\n\nThe user already has a plan. Modify it based on the "
                "conversation. Return the same JSON structure.\n"
                + json.dumps(payload.current_plan)
            )
        messages_for_grok = [{"role": "system", "content": prompt}] + [
            {"role": m.role, "content": m.content} for m in payload.messages
        ]
        response = grok_client.chat.completions.create(
            model=GROK_MODEL,
            temperature=0.7,
            messages=messages_for_grok,
        )
        raw = response.choices[0].message.content
        try:
            schedule = parse_schedule_response(raw)
        except Exception:
            schedule = None
        label = "updated" if payload.action == "modify" else "ready"
        return {"message": f"Your plan is {label}!", "schedule": schedule}

    # ── Chat mode ────────────────────────────────────────────────────────────
    system_prompt = (
        "You are an expert AI health coach having a warm, concise conversation "
        "to understand the user's lifestyle so you can build a personalized health plan. "
        "Gather info about: sleep quality, daily activity level, diet/eating habits, "
        "stress levels, and specific health goals. "
        "Keep each response SHORT — 2 to 4 sentences max. Be conversational and warm. "
        "Acknowledge what the user shared before asking the next question. "
        "After 3-4 exchanges tell them you have enough info and they can tap Generate."
    )
    messages_for_grok = [{"role": "system", "content": system_prompt}] + [
        {"role": m.role, "content": m.content} for m in payload.messages
    ]
    response = grok_client.chat.completions.create(
        model=GROK_MODEL,
        temperature=0.85,
        max_tokens=220,
        messages=messages_for_grok,
    )
    return {"message": response.choices[0].message.content}
