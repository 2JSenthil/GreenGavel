from retrieval import retrieve_chunks
from llm import ask_llm


def build_context(rows):
    """
    Turn retrieved Snowflake rows into a context block
    that Gemini can use.
    """

    context_parts = []

    for row in rows:
        meeting_date = row[0]
        document_type = row[1]
        status = row[2]
        chunk_text = row[3]
        source_url = row[4]

        context_part = f"""
Meeting date: {meeting_date}
Document type: {document_type}
Status: {status}

Text:
{chunk_text}

Source:
{source_url}
"""

        context_parts.append(context_part)

    return "\n\n--------------------\n\n".join(context_parts)


def get_sources(rows):
    """
    Get unique source URLs from the retrieved chunks.
    """

    sources = []

    for row in rows:
        source_url = row[4]

        if source_url and source_url not in sources:
            sources.append(source_url)

    return sources


def answer_question(question):
    """
    Full RAG pipeline:

    1. Search Snowflake for relevant chunks
    2. Build context from those chunks
    3. Send context + question to Gemini
    4. Return answer + sources
    """

    rows = retrieve_chunks(
        question=question,
        limit=8
    )

    if not rows:
        return {
            "answer": (
                "I couldn't find relevant Chapel Hill government "
                "records for that question."
            ),
            "sources": []
        }

    context = build_context(rows)

    answer = ask_llm(
        question=question,
        context=context
    )

    sources = get_sources(rows)

    return {
        "answer": answer,
        "sources": sources
    }


if __name__ == "__main__":

    print("Green Gavel")
    print("Ask a question about Chapel Hill local government.")
    print()

    question = input("Question: ")

    print("\nSearching government records...\n")

    result = answer_question(question)

    print("ANSWER:\n")
    print(result["answer"])

    print("\nSOURCES:\n")

    if result["sources"]:
        for source in result["sources"]:
            print("-", source)
    else:
        print("No sources found.")