
# ═══════════════════════════════════════════════════════════════════════════════
# BACKEND CHANGES NEEDED — apply these in your upquest-backend GitHub repo
# ═══════════════════════════════════════════════════════════════════════════════
#
# FILE 1: api/index.py
# ─────────────────────────────────────────────────────────────────────────────
# Update the PlanChatRequest model and plan_chat endpoint as shown below.
# Make sure the top of index.py has: from typing import Optional, List, Dict, Any
#
# FILE 2: schedule_generator.py
# ─────────────────────────────────────────────────────────────────────────────
# Update build_schedule_prompt() to accept and use the health_data argument.
#
# ═══════════════════════════════════════════════════════════════════════════════


# ── FILE 1: api/index.py changes ──────────────────────────────────────────────

class PlanChatMessage(BaseModel):
    role: str
    content: str

class PlanChatRequest(BaseModel):
    messages:     List[PlanChatMessage] = []
    stats:        Dict[str, Any]        = {}
    goals:        List[str]             = []
    action:       str                   = "chat"   # "chat" | "generate" | "modify"
    current_plan: Any                   = None
    labs:         Any                   = None
    health_data:  Optional[str]         = None      # ← NEW: plain-text Apple Health snapshot


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
            health_data=payload.health_data,   # ← PASS HEALTH DATA
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

    # ── Chat mode (unchanged) ────────────────────────────────────────────────
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


# ── FILE 2: schedule_generator.py — update build_schedule_prompt() ────────────
#
# Change the function signature and add the health_data block inside the prompt.
# The section below shows only what changes — keep everything else the same.

def build_schedule_prompt(
    stats: dict,
    goals: list,
    bloodwork: dict | None = None,
    week_start: str = "",
    health_data: str | None = None,          # ← ADD THIS PARAMETER
) -> str:

    # ... (keep your existing stats/goals prompt building) ...

    # ADD THIS BLOCK — insert right before the final JSON instructions:
    health_section = ""
    if health_data:
        health_section = f"""

## Real-Time Apple Health & Apple Watch Data
The following data was automatically synced from the user's iPhone and Apple Watch
seconds before this request. Use it to calibrate workout intensity, rest days,
sleep-based recovery recommendations, and nutrition timing:

{health_data}

Key guidance:
- If resting HR is elevated (>10 bpm above normal) or HRV is low → prioritize recovery today
- If sleep < 6 hrs last night → reduce workout intensity, add extra rest
- If VO2 Max is known → calibrate cardio zones to match their actual fitness level
- If blood oxygen < 95% → flag this and recommend a doctor consultation
- Use step count and active calories to gauge baseline daily activity level
- Adjust weekly workout volume based on workoutsThisWeek (avoid overtraining)
"""

    # Then append health_section to your prompt string before returning it.
    # e.g.: return base_prompt + health_section + json_instructions
