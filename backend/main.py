from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Base, Conversation

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DealMate AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "DealMate AI backend is running!"
    }


@app.post("/conversations")
def add_conversation(data: dict):
    db: Session = SessionLocal()

    try:
        customer = data.get("customer", "").strip()
        content = data.get("content", "").strip()

        if not customer or not content:
            return {
                "message": "Customer and content are required"
            }

        conversation = Conversation(
            customer=customer,
            content=content
        )

        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        return {
            "message": "Conversation saved successfully",
            "id": conversation.id,
            "customer": conversation.customer,
            "content": conversation.content
        }

    except Exception as error:
        db.rollback()

        print("DATABASE ERROR:", error)

        return {
            "message": "Database error",
            "error": str(error)
        }

    finally:
        db.close()


@app.get("/conversations")
def get_conversations():
    db: Session = SessionLocal()

    try:
        conversations = (
            db.query(Conversation)
            .order_by(Conversation.id.desc())
            .all()
        )

        result = []

        for conversation in conversations:
            result.append({
                "id": conversation.id,
                "customer": conversation.customer,
                "content": conversation.content,
                "created_at": conversation.created_at
            })

        return result

    finally:
        db.close()


def contains_any(text, keywords):
    text = text.lower()

    return any(
        keyword.lower() in text
        for keyword in keywords
    )


def extract_memory(customer, content):
    """
    Converts a raw sales conversation into
    structured memory signals.
    """

    text = content.lower()

    memories = []

    # REQUIREMENTS
    if contains_any(
        text,
        [
            "need",
            "needs",
            "requirement",
            "requires",
            "want",
            "wants",
            "api",
            "integration",
            "technical",
            "feature",
            "documentation",
        ]
    ):
        memories.append({
            "type": "Requirement",
            "customer": customer,
            "text": content,
            "confidence": "High"
        })

    # PRICING
    if contains_any(
        text,
        [
            "price",
            "pricing",
            "cost",
            "budget",
            "expensive",
            "discount",
            "quote",
            "proposal",
        ]
    ):
        memories.append({
            "type": "Pricing",
            "customer": customer,
            "text": content,
            "confidence": "High"
        })

    # OBJECTIONS
    if contains_any(
        text,
        [
            "objection",
            "object",
            "concern",
            "problem",
            "issue",
            "hesitation",
            "worried",
            "not sure",
            "too expensive",
            "difficult",
        ]
    ):
        memories.append({
            "type": "Objection",
            "customer": customer,
            "text": content,
            "confidence": "High"
        })

    # FOLLOW-UP
    if contains_any(
        text,
        [
            "follow up",
            "follow-up",
            "next week",
            "next step",
            "pending",
            "send",
            "schedule",
            "call back",
            "contact",
            "review",
        ]
    ):
        memories.append({
            "type": "Follow-up",
            "customer": customer,
            "text": content,
            "confidence": "High"
        })

    # COMPETITOR
    if contains_any(
        text,
        [
            "competitor",
            "competitors",
            "alternative",
            "alternatives",
            "compared",
            "comparison",
            "other vendor",
            "other provider",
        ]
    ):
        memories.append({
            "type": "Competitor",
            "customer": customer,
            "text": content,
            "confidence": "Medium"
        })

    # DECISION
    if contains_any(
        text,
        [
            "agreed",
            "decision",
            "decided",
            "approved",
            "approval",
            "accepted",
            "confirmed",
            "signed",
        ]
    ):
        memories.append({
            "type": "Decision",
            "customer": customer,
            "text": content,
            "confidence": "High"
        })

    return memories


@app.post("/memory")
def create_memory(data: dict):
    customer = data.get(
        "customer",
        ""
    ).strip()

    content = data.get(
        "content",
        ""
    ).strip()

    if not customer or not content:
        return {
            "message": "Customer and content are required",
            "memories": []
        }

    memories = extract_memory(
        customer,
        content
    )

    return {
        "message": "Memory extracted successfully",
        "customer": customer,
        "memories": memories
    }


@app.post("/ask")
def ask_ai(data: dict):
    query = data.get(
        "query",
        ""
    ).strip().lower()

    if not query:
        return {
            "answer": (
                "Ask me something about your "
                "customers or deals."
            )
        }

    db: Session = SessionLocal()

    try:
        conversations = (
            db.query(Conversation)
            .order_by(
                Conversation.id.desc()
            )
            .all()
        )

        if not conversations:
            return {
                "answer": (
                    "I don't have any customer "
                    "conversations stored yet. "
                    "Add a conversation first."
                )
            }

        # CUSTOMER MATCHING

        customer_matches = []

        for conversation in conversations:
            customer_name = (
                conversation.customer or ""
            ).lower()

            if customer_name in query:
                customer_matches.append(
                    conversation
                )

        # INTENT DETECTION

        intent_keywords = {
            "pricing": [
                "price",
                "pricing",
                "cost",
                "budget",
                "expensive",
                "money",
            ],

            "objection": [
                "objection",
                "object",
                "concern",
                "problem",
                "issue",
                "hesitation",
            ],

            "requirement": [
                "requirement",
                "requirements",
                "need",
                "needs",
                "api",
                "integration",
                "technical",
            ],

            "followup": [
                "follow",
                "follow-up",
                "follow up",
                "next step",
                "next steps",
                "send",
                "pending",
                "commitment",
            ],

            "meeting": [
                "meeting",
                "prepare",
                "preparation",
                "brief",
                "next meeting",
            ],

            "competitor": [
                "competitor",
                "competitors",
                "alternative",
                "alternatives",
                "compared",
                "comparison",
            ],
        }

        detected_intent = None

        for intent, keywords in (
            intent_keywords.items()
        ):
            if any(
                keyword in query
                for keyword in keywords
            ):
                detected_intent = intent
                break

        # FIND RELEVANT CONVERSATIONS

        relevant = []

        if customer_matches:
            relevant = customer_matches

        elif detected_intent:
            keywords = (
                intent_keywords[
                    detected_intent
                ]
            )

            for conversation in conversations:
                text = (
                    conversation.content or ""
                ).lower()

                if any(
                    keyword in text
                    for keyword in keywords
                ):
                    relevant.append(
                        conversation
                    )

        else:
            query_words = query.split()

            for conversation in conversations:
                text = (
                    f"{conversation.customer} "
                    f"{conversation.content}"
                ).lower()

                if any(
                    word in text
                    for word in query_words
                    if len(word) > 2
                ):
                    relevant.append(
                        conversation
                    )

        # GENERIC DEMO FALLBACK

        if (
            not relevant
            and detected_intent
        ):
            relevant = conversations[:5]

        # NO RESULTS

        if not relevant:
            return {
                "answer": (
                    "I couldn't find matching "
                    "customer context in DealMate's "
                    "memory. Try mentioning the "
                    "customer name or asking about "
                    "pricing, requirements, "
                    "objections, or follow-ups."
                )
            }

        # REMOVE DUPLICATES

        unique = {}

        for conversation in relevant:
            unique[
                conversation.id
            ] = conversation

        relevant = list(
            unique.values()
        )

        # GENERATE RESPONSE

        if detected_intent == "meeting":

            lines = [
                "Meeting Brief",
                "",
                "Here is the customer context "
                "you should review:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    conversation.customer
                )

                lines.append(
                    conversation.content
                )

            lines.append("")

            lines.append(
                "Recommended focus: review "
                "requirements, customer concerns, "
                "pricing discussions and pending "
                "next steps before the meeting."
            )

            answer = "\n".join(lines)

        elif detected_intent == "pricing":

            lines = [
                "Pricing Context",
                "",
                "Relevant pricing signals "
                "from memory:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        elif detected_intent == "objection":

            lines = [
                "Customer Objections & Concerns",
                "",
                "Relevant concerns found "
                "in memory:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        elif detected_intent == "requirement":

            lines = [
                "Customer Requirements",
                "",
                "Requirements remembered from "
                "previous conversations:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        elif detected_intent == "followup":

            lines = [
                "Pending Follow-ups",
                "",
                "Next actions remembered "
                "by DealMate:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        elif detected_intent == "competitor":

            lines = [
                "Competitive Context",
                "",
                "Relevant competitive "
                "information from memory:",
            ]

            for conversation in relevant[:5]:

                lines.append("")

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        else:

            lines = [
                "Relevant DealMate Memory",
                "",
            ]

            for conversation in relevant[:5]:

                lines.append(
                    f"{conversation.customer}: "
                    f"{conversation.content}"
                )

            answer = "\n".join(lines)

        return {
            "answer": answer,
            "sources": [
                {
                    "id": conversation.id,
                    "customer": conversation.customer,
                }
                for conversation in relevant[:5]
            ],
        }

    except Exception as error:

        print(
            "AI SEARCH ERROR:",
            error
        )

        return {
            "answer": (
                "Something went wrong while "
                "searching DealMate memory."
            )
        }

    finally:
        db.close()