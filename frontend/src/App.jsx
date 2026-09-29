import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const demoDeals = [
  {
    id: "d1",
    customer: "TechNova",
    value: "$42,000",
    stage: "Technical Review",
    probability: "68%",
    nextStep: "Share API documentation",
    risk: "Integration",
  },
  {
    id: "d2",
    customer: "Acme Corporation",
    value: "$48,000",
    stage: "Proposal",
    probability: "72%",
    nextStep: "Send revised proposal",
    risk: "Pricing",
  },
  {
    id: "d3",
    customer: "NovaTech",
    value: "$32,500",
    stage: "Discovery",
    probability: "61%",
    nextStep: "Confirm technical requirements",
    risk: "Follow-up",
  },
  {
    id: "d4",
    customer: "FinEdge",
    value: "$21,000",
    stage: "Negotiation",
    probability: "51%",
    nextStep: "Clarify implementation cost",
    risk: "Budget",
  },
];

const quickPrompts = [
  "Prepare me for my next meeting",
  "What did the customer object to?",
  "What should I follow up on?",
];

const memoryTypes = [
  "All",
  "Requirement",
  "Pricing",
  "Objection",
  "Follow-up",
  "Competitor",
  "Decision",
];

function App() {
  const [page, setPage] = useState("Dashboard");

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] =
    useState(true);
  const [backendError, setBackendError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [customer, setCustomer] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [search, setSearch] = useState("");
  const [memoryFilter, setMemoryFilter] = useState("All");
  const [toast, setToast] = useState("");

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      setLoadingConversations(true);
      setBackendError("");

      const response = await fetch(
        `${API_URL}/conversations`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load conversations"
        );
      }

      const data = await response.json();

      setConversations(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);

      setBackendError(
        "Backend connection unavailable."
      );
    } finally {
      setLoadingConversations(false);
    }
  }

  async function askAI(customQuery = null) {
    const finalQuery = customQuery || query;

    if (!finalQuery.trim()) {
      setAnswer(
        "Ask me something about your customers or deals."
      );
      return;
    }

    setQuery(finalQuery);

    try {
      setLoadingAI(true);
      setAnswer("");

      const response = await fetch(
        `${API_URL}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: finalQuery,
          }),
        }
      );

      const data = await response.json();

      setAnswer(
        data.answer ||
          "I couldn't find relevant information in DealMate memory."
      );
    } catch (error) {
      console.error(error);

      setAnswer(
        "I couldn't connect to DealMate AI. Make sure the backend is running."
      );
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleAddConversation(event) {
    event.preventDefault();

    if (
      !customer.trim() ||
      !content.trim()
    ) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: customer.trim(),
            content: content.trim(),
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data.message === "Database error"
      ) {
        throw new Error(
          data.error ||
            "Unable to save conversation"
        );
      }

      const memoryResponse = await fetch(
        `${API_URL}/memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: customer.trim(),
            content: content.trim(),
          }),
        }
      );

      const memoryData =
        await memoryResponse.json();

      console.log(
        "DealMate extracted memory:",
        memoryData
      );

      setCustomer("");
      setContent("");
      setShowAddModal(false);

      await loadConversations();

      const signalCount =
        memoryData.memories?.length || 0;

      if (signalCount > 0) {
        showToast(
          `${signalCount} memory signals extracted`
        );
      } else {
        showToast(
          "Conversation saved to memory"
        );
      }
    } catch (error) {
      console.error(error);

      showToast(
        "Could not save conversation"
      );
    } finally {
      setSaving(false);
    }
  }

  function showToast(message) {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 2500);
  }

  function navigate(destination) {
    setPage(destination);
  }

  const customers = useMemo(() => {
    const map = new Map();

    conversations.forEach(
      (conversation) => {
        if (
          !map.has(
            conversation.customer
          )
        ) {
          map.set(
            conversation.customer,
            {
              name:
                conversation.customer,
              conversations: 0,
              latest:
                conversation.content,
            }
          );
        }

        map.get(
          conversation.customer
        ).conversations += 1;
      }
    );

    return Array.from(
      map.values()
    );
  }, [conversations]);

  const memories = useMemo(() => {
    const results = [];

    conversations.forEach(
      (conversation) => {
        const text = (
          conversation.content || ""
        ).toLowerCase();

        if (
          text.includes("need") ||
          text.includes("needs") ||
          text.includes("requirement") ||
          text.includes("requires") ||
          text.includes("want") ||
          text.includes("wants") ||
          text.includes("api") ||
          text.includes("integration") ||
          text.includes("technical") ||
          text.includes("feature") ||
          text.includes("documentation")
        ) {
          results.push({
            id: `${conversation.id}-requirement`,
            type: "Requirement",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }

        if (
          text.includes("price") ||
          text.includes("pricing") ||
          text.includes("cost") ||
          text.includes("budget") ||
          text.includes("expensive") ||
          text.includes("discount") ||
          text.includes("quote") ||
          text.includes("proposal")
        ) {
          results.push({
            id: `${conversation.id}-pricing`,
            type: "Pricing",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }

        if (
          text.includes("objection") ||
          text.includes("object") ||
          text.includes("concern") ||
          text.includes("problem") ||
          text.includes("issue") ||
          text.includes("hesitation") ||
          text.includes("worried") ||
          text.includes("not sure") ||
          text.includes("difficult")
        ) {
          results.push({
            id: `${conversation.id}-objection`,
            type: "Objection",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }

        if (
          text.includes("follow up") ||
          text.includes("follow-up") ||
          text.includes("next week") ||
          text.includes("next step") ||
          text.includes("pending") ||
          text.includes("send") ||
          text.includes("schedule") ||
          text.includes("review")
        ) {
          results.push({
            id: `${conversation.id}-followup`,
            type: "Follow-up",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }

        if (
          text.includes("competitor") ||
          text.includes("competitors") ||
          text.includes("compared") ||
          text.includes("comparison") ||
          text.includes("alternative") ||
          text.includes("alternatives")
        ) {
          results.push({
            id: `${conversation.id}-competitor`,
            type: "Competitor",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }

        if (
          text.includes("agreed") ||
          text.includes("decision") ||
          text.includes("decided") ||
          text.includes("approved") ||
          text.includes("approval") ||
          text.includes("accepted") ||
          text.includes("confirmed")
        ) {
          results.push({
            id: `${conversation.id}-decision`,
            type: "Decision",
            customer:
              conversation.customer,
            text:
              conversation.content,
          });
        }
      }
    );

    return results;
  }, [conversations]);

  const filteredMemories = useMemo(() => {
    if (memoryFilter === "All") {
      return memories;
    }

    return memories.filter(
      (memory) =>
        memory.type === memoryFilter
    );
  }, [memories, memoryFilter]);

  const totalPipeline = demoDeals.reduce(
    (sum, deal) => {
      const numericValue = Number(
        deal.value
          .replace("$", "")
          .replace(",", "")
      );

      return sum + numericValue;
    },
    0
  );

  const activeDeals =
    demoDeals.length;

  const attentionDeals =
    demoDeals.filter(
      (deal) =>
        deal.risk === "Pricing" ||
        deal.risk === "Integration" ||
        deal.risk === "Budget"
    ).length;

  const followUpCount =
    demoDeals.filter(
      (deal) => deal.nextStep
    ).length;

  const memoryCount =
    conversations.length;

  function renderDashboard() {
    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              Sales workspace
            </p>

            <h1>
              Good evening.
            </h1>

            <p>
              Your customer memory is ready.
              Ask anything about your deals.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              setShowAddModal(true)
            }
          >
            + Add conversation
          </button>
        </div>

        <section className="ai-hero">
          <div className="ai-hero-top">
            <div>
              <span className="ai-label">
                DEALMATE AI
              </span>

              <h2>
                What do you need to remember?
              </h2>

              <p>
                Search across customer
                conversations, requirements,
                objections and follow-ups.
              </p>
            </div>

            <div className="ai-orb">
              ✦
            </div>
          </div>

          <div className="ai-search">
            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  askAI();
                }
              }}
              placeholder="e.g. What does TechNova need?"
            />

            <button
              onClick={() =>
                askAI()
              }
            >
              {loadingAI
                ? "Thinking..."
                : "Ask AI"}
            </button>
          </div>

          <div className="quick-prompts">
            <span>
              Try asking
            </span>

            {quickPrompts.map(
              (prompt) => (
                <button
                  key={prompt}
                  onClick={() =>
                    askAI(prompt)
                  }
                >
                  {prompt}
                </button>
              )
            )}
          </div>

          {answer && (
            <div className="ai-answer">
              <div className="answer-label">
                DEALMATE MEMORY
              </div>

              <p>{answer}</p>
            </div>
          )}
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <span>
              Active deals
            </span>

            <strong>
              {activeDeals}
            </strong>

            <small>
              Across your pipeline
            </small>
          </div>

          <div className="stat-card">
            <span>
              Pipeline
            </span>

            <strong>
              $
              {(
                totalPipeline / 1000
              ).toFixed(1)}
              K
            </strong>

            <small>
              Total tracked value
            </small>
          </div>

          <div className="stat-card">
            <span>
              Memories
            </span>

            <strong>
              {memoryCount}
            </strong>

            <small>
              Customer conversations
            </small>
          </div>

          <div className="stat-card">
            <span>
              Follow-ups
            </span>

            <strong>
              {followUpCount}
            </strong>

            <small>
              Next actions tracked
            </small>
          </div>
        </div>

        <div className="content-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">
                  MEMORY
                </span>

                <h3>
                  Recent conversations
                </h3>
              </div>

              <button
                className="text-button"
                onClick={() =>
                  navigate(
                    "AI Memory"
                  )
                }
              >
                View all
              </button>
            </div>

            {loadingConversations ? (
              <div className="empty-state">
                Loading conversations...
              </div>
            ) : conversations.length ===
              0 ? (
              <div className="empty-state">
                No conversations yet.
              </div>
            ) : (
              <div className="conversation-list">
                {conversations
                  .slice(0, 5)
                  .map(
                    (
                      conversation
                    ) => (
                      <button
                        className="conversation-row"
                        key={
                          conversation.id
                        }
                        onClick={() =>
                          setSelectedConversation(
                            conversation
                          )
                        }
                      >
                        <div className="conversation-avatar">
                          {conversation.customer
                            ?.charAt(
                              0
                            )
                            ?.toUpperCase()}
                        </div>

                        <div className="conversation-main">
                          <strong>
                            {
                              conversation.customer
                            }
                          </strong>

                          <span>
                            {
                              conversation.content
                            }
                          </span>
                        </div>

                        <span className="memory-badge">
                          Memory
                        </span>
                      </button>
                    )
                  )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">
                  DEALS
                </span>

                <h3>
                  Needs attention
                </h3>
              </div>

              <button
                className="text-button"
                onClick={() =>
                  navigate("Deals")
                }
              >
                View pipeline
              </button>
            </div>

            <div className="attention-list">
              {demoDeals
                .slice(0, 4)
                .map((deal) => (
                  <div
                    className="attention-row"
                    key={deal.id}
                  >
                    <div>
                      <strong>
                        {deal.customer}
                      </strong>

                      <span>
                        {deal.nextStep}
                      </span>
                    </div>

                    <span className="risk-badge">
                      {deal.risk}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderDeals() {
    function openDeal(deal) {
      const customerConversation =
        conversations.find(
          (conversation) =>
            conversation.customer
              ?.toLowerCase() ===
            deal.customer.toLowerCase()
        );

      if (customerConversation) {
        setSelectedConversation(
          customerConversation
        );
        return;
      }

      showToast(
        `No conversation memory found for ${deal.customer}`
      );
    }

    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              Pipeline
            </p>

            <h1>
              Deals
            </h1>

            <p>
              Track deal context, customer
              memory and next actions in one
              place.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              setShowAddModal(true)
            }
          >
            + Add conversation
          </button>
        </div>

        <div className="stats-grid compact">
          <div className="stat-card">
            <span>
              Pipeline
            </span>

            <strong>
              $
              {(
                totalPipeline / 1000
              ).toFixed(1)}
              K
            </strong>

            <small>
              Total tracked value
            </small>
          </div>

          <div className="stat-card">
            <span>
              Open deals
            </span>

            <strong>
              {activeDeals}
            </strong>

            <small>
              Active opportunities
            </small>
          </div>

          <div className="stat-card">
            <span>
              At risk
            </span>

            <strong>
              {attentionDeals}
            </strong>

            <small>
              Deals needing attention
            </small>
          </div>

          <div className="stat-card">
            <span>
              Follow-ups
            </span>

            <strong>
              {followUpCount}
            </strong>

            <small>
              Next actions tracked
            </small>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                PIPELINE
              </span>

              <h3>
                Active opportunities
              </h3>

              <p className="panel-description">
                Click a deal to open its
                customer memory.
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="deal-table">
              <thead>
                <tr>
                  <th>
                    Customer
                  </th>

                  <th>
                    Value
                  </th>

                  <th>
                    Stage
                  </th>

                  <th>
                    Probability
                  </th>

                  <th>
                    Next step
                  </th>

                  <th>
                    Risk
                  </th>
                </tr>
              </thead>

              <tbody>
                {demoDeals.map(
                  (deal) => (
                    <tr
                      key={
                        deal.id
                      }
                      onClick={() =>
                        openDeal(
                          deal
                        )
                      }
                      style={{
                        cursor:
                          "pointer",
                      }}
                    >
                      <td>
                        <strong>
                          {
                            deal.customer
                          }
                        </strong>
                      </td>

                      <td>
                        {deal.value}
                      </td>

                      <td>
                        <span className="stage-badge">
                          {
                            deal.stage
                          }
                        </span>
                      </td>

                      <td>
                        {
                          deal.probability
                        }
                      </td>

                      <td>
                        {
                          deal.nextStep
                        }
                      </td>

                      <td>
                        <span className="risk-badge">
                          {deal.risk}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="panel"
          style={{
            marginTop: "18px",
          }}
        >
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                MEMORY CONNECTION
              </span>

              <h3>
                From deal activity to
                customer context
              </h3>

              <p className="panel-description">
                DealMate connects pipeline
                activity with the conversations
                behind it.
              </p>
            </div>
          </div>

          <div className="insight-list">
            {demoDeals
              .slice(0, 4)
              .map((deal) => {
                const memory =
                  conversations.find(
                    (conversation) =>
                      conversation.customer
                        ?.toLowerCase() ===
                      deal.customer.toLowerCase()
                  );

                return (
                  <div
                    className="insight-row"
                    key={deal.id}
                  >
                    <div className="insight-icon">
                      ✦
                    </div>

                    <div>
                      <strong>
                        {deal.customer}
                      </strong>

                      <p>
                        {memory
                          ? memory.content
                          : `No conversation has been added for ${deal.customer} yet.`}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    );
  }

  function renderCustomers() {
    const visibleCustomers =
      customers.filter(
        (item) => {
          const value = search
            .trim()
            .toLowerCase();

          if (!value) {
            return true;
          }

          return item.name
            ?.toLowerCase()
            .includes(value);
        }
      );

    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              Relationships
            </p>

            <h1>
              Customers
            </h1>

            <p>
              Every customer relationship,
              backed by persistent memory.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              setShowAddModal(true)
            }
          >
            + Add conversation
          </button>
        </div>

        <div className="search-box">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search customers..."
          />
        </div>

        {visibleCustomers.length ===
        0 ? (
          <section className="panel">
            <div className="empty-state">
              No customers found.
            </div>
          </section>
        ) : (
          <div className="customer-grid">
            {visibleCustomers.map(
              (item) => {
                const customerMemories =
                  conversations.filter(
                    (
                      conversation
                    ) =>
                      conversation.customer ===
                      item.name
                  );

                return (
                  <div
                    className="customer-card"
                    key={
                      item.name
                    }
                  >
                    <div className="customer-card-top">
                      <div className="customer-avatar">
                        {item.name
                          ?.charAt(
                            0
                          )
                          ?.toUpperCase()}
                      </div>

                      <div>
                        <h3>
                          {item.name}
                        </h3>

                        <span>
                          {
                            item.conversations
                          }{" "}
                          conversation
                          {item.conversations !==
                          1
                            ? "s"
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="customer-memory-preview">
                      <span className="panel-kicker">
                        LATEST MEMORY
                      </span>

                      <p>
                        {item.latest}
                      </p>
                    </div>

                    <div className="customer-card-actions">
                      <button
                        className="secondary-button"
                        onClick={() => {
                          if (
                            customerMemories.length >
                            0
                          ) {
                            setSelectedConversation(
                              customerMemories[0]
                            );
                          }
                        }}
                      >
                        View memory
                      </button>

                      <button
                        className="primary-button"
                        onClick={() => {
                          setQuery(
                            `Prepare me for my ${item.name} meeting`
                          );

                          navigate(
                            "Dashboard"
                          );
                        }}
                      >
                        Prepare with AI
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    );
  }

  function renderMemory() {
    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              Persistent context
            </p>

            <h1>
              AI Memory
            </h1>

            <p>
              DealMate turns scattered
              conversations into searchable
              customer intelligence.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              setShowAddModal(true)
            }
          >
            + Add memory
          </button>
        </div>

        <div className="stats-grid compact">
          <div className="stat-card">
            <span>
              Conversations
            </span>

            <strong>
              {memoryCount}
            </strong>

            <small>
              Stored in memory
            </small>
          </div>

          <div className="stat-card">
            <span>
              Signals
            </span>

            <strong>
              {memories.length}
            </strong>

            <small>
              Context extracted
            </small>
          </div>

          <div className="stat-card">
            <span>
              Customers
            </span>

            <strong>
              {customers.length}
            </strong>

            <small>
              Relationships remembered
            </small>
          </div>

          <div className="stat-card">
            <span>
              Follow-ups
            </span>

            <strong>
              {
                memories.filter(
                  (memory) =>
                    memory.type ===
                    "Follow-up"
                ).length
              }
            </strong>

            <small>
              Action signals
            </small>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                MEMORY STREAM
              </span>

              <h3>
                What DealMate remembers
              </h3>

              <p className="panel-description">
                Customer context automatically
                organized into useful sales
                signals.
              </p>
            </div>
          </div>

          <div className="memory-filters">
            {memoryTypes.map(
              (type) => (
                <button
                  key={type}
                  className={
                    memoryFilter ===
                    type
                      ? "memory-filter active"
                      : "memory-filter"
                  }
                  onClick={() =>
                    setMemoryFilter(
                      type
                    )
                  }
                >
                  {type}

                  {type !==
                    "All" && (
                    <span>
                      {
                        memories.filter(
                          (memory) =>
                            memory.type ===
                            type
                        ).length
                      }
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {filteredMemories.length ===
          0 ? (
            <div className="empty-state">
              {memories.length ===
              0
                ? "Add customer conversations to create persistent memory."
                : "No memories match this category."}
            </div>
          ) : (
            <div className="memory-grid">
              {filteredMemories.map(
                (memory) => (
                  <button
                    className="memory-card"
                    key={memory.id}
                    onClick={() => {
                      const conversation =
                        conversations.find(
                          (
                            item
                          ) =>
                            item.customer ===
                              memory.customer &&
                            item.content ===
                              memory.text
                        );

                      if (
                        conversation
                      ) {
                        setSelectedConversation(
                          conversation
                        );
                      }
                    }}
                  >
                    <div className="memory-card-header">
                      <span className="memory-type">
                        {
                          memory.type
                        }
                      </span>

                      <span className="memory-customer">
                        {
                          memory.customer
                        }
                      </span>
                    </div>

                    <p>
                      {memory.text}
                    </p>

                    <span className="memory-card-footer">
                      View source conversation →
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderInsights() {
    const categoryCounts =
      memories.reduce(
        (acc, memory) => {
          acc[memory.type] =
            (acc[memory.type] ||
              0) + 1;

          return acc;
        },
        {}
      );

    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              Intelligence
            </p>

            <h1>
              Insights
            </h1>

            <p>
              Patterns emerging from your
              sales conversations.
            </p>
          </div>
        </div>

        <div className="insight-grid">
          <div className="insight-card">
            <span>
              Requirements
            </span>

            <strong>
              {
                categoryCounts.Requirement ||
                0
              }
            </strong>

            <p>
              Customer needs identified
            </p>
          </div>

          <div className="insight-card">
            <span>
              Pricing
            </span>

            <strong>
              {
                categoryCounts.Pricing ||
                0
              }
            </strong>

            <p>
              Pricing signals detected
            </p>
          </div>

          <div className="insight-card">
            <span>
              Objections
            </span>

            <strong>
              {
                categoryCounts.Objection ||
                0
              }
            </strong>

            <p>
              Customer concerns detected
            </p>
          </div>

          <div className="insight-card">
            <span>
              Follow-ups
            </span>

            <strong>
              {
                categoryCounts[
                  "Follow-up"
                ] || 0
              }
            </strong>

            <p>
              Action signals identified
            </p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                AI SIGNALS
              </span>

              <h3>
                What DealMate is remembering
              </h3>
            </div>
          </div>

          <div className="insight-list">
            {memories.length ===
            0 ? (
              <div className="empty-state">
                Add more conversations to
                generate insights.
              </div>
            ) : (
              memories
                .slice(0, 8)
                .map(
                  (
                    memory,
                    index
                  ) => (
                    <div
                      className="insight-row"
                      key={index}
                    >
                      <div className="insight-icon">
                        ✦
                      </div>

                      <div>
                        <strong>
                          {
                            memory.type
                          }{" "}
                          ·{" "}
                          {
                            memory.customer
                          }
                        </strong>

                        <p>
                          {
                            memory.text
                          }
                        </p>
                      </div>
                    </div>
                  )
                )
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderPage() {
    switch (page) {
      case "Deals":
        return renderDeals();

      case "Customers":
        return renderCustomers();

      case "AI Memory":
        return renderMemory();

      case "Insights":
        return renderInsights();

      default:
        return renderDashboard();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            D
          </div>

          <div>
            <strong>
              DealMate
            </strong>

            <span>
              AI SALES MEMORY
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={
              page === "Dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "Dashboard"
              )
            }
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={
              page === "Deals"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate("Deals")
            }
          >
            <span>◫</span>
            Deals
          </button>

          <button
            className={
              page === "Customers"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "Customers"
              )
            }
          >
            <span>◎</span>
            Customers
          </button>

          <button
            className={
              page === "AI Memory"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "AI Memory"
              )
            }
          >
            <span>✦</span>
            AI Memory
          </button>

          <button
            className={
              page === "Insights"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "Insights"
              )
            }
          >
            <span>◌</span>
            Insights
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="workspace-card">
            <span>
              WORKSPACE
            </span>

            <strong>
              Sales Team
            </strong>

            <small>
              DealMate AI
            </small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace{" "}
            <span>/</span>{" "}
            {page}
          </div>

          <div className="topbar-actions">
            {backendError && (
              <span className="backend-status">
                Backend offline
              </span>
            )}

            <button
              className="topbar-add"
              onClick={() =>
                setShowAddModal(
                  true
                )
              }
            >
              + Add conversation
            </button>

            <div className="profile">
              <div className="profile-avatar">
                A
              </div>

              <div>
                <strong>
                  Sales Workspace
                </strong>

                <span>
                  Admin
                </span>
              </div>
            </div>
          </div>
        </header>

        {renderPage()}
      </main>

      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowAddModal(
              false
            )
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="panel-kicker">
                  NEW MEMORY
                </span>

                <h2>
                  Add conversation
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowAddModal(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleAddConversation
              }
            >
              <label>
                Customer

                <input
                  value={customer}
                  onChange={(event) =>
                    setCustomer(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. TechNova"
                />
              </label>

              <label>
                Conversation notes

                <textarea
                  value={content}
                  onChange={(event) =>
                    setContent(
                      event.target
                        .value
                    )
                  }
                  placeholder="Add requirements, objections, pricing discussions, follow-ups..."
                  rows="7"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowAddModal(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save to memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedConversation && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedConversation(
              null
            )
          }
        >
          <div
            className="modal conversation-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="panel-kicker">
                  CUSTOMER MEMORY
                </span>

                <h2>
                  {
                    selectedConversation.customer
                  }
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedConversation(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="conversation-detail">
              <span className="memory-badge">
                Memory
              </span>

              <p>
                {
                  selectedConversation.content
                }
              </p>

              <div className="detail-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    setQuery(
                      `Prepare me for my ${selectedConversation.customer} meeting`
                    );

                    setSelectedConversation(
                      null
                    );

                    navigate(
                      "Dashboard"
                    );
                  }}
                >
                  Prepare with AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;