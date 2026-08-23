import json, os
from anthropic import Anthropic, beta_tool

client = Anthropic(
	api_key=os.environ.get("ANTHROPIC_API_KEY"),
)

@beta_tool
def get_weather(location: str) -> str:
    """Get the weather for a given location.

    Args:
        location: The city and state, for example, San Francisco, CA
    Returns:
        A JSON-encoded string with the location, temperature, and weather condition.
    """
    return json.dumps(
        {
            "location": location,
            "temperature": "68°F",
            "condition": "Sunny",
        }
    )


# Use the tool_runner to automatically handle tool calls
runner = client.beta.messages.tool_runner(
    max_tokens=1024,
    model="claude-opus-5",
    tools=[get_weather],
    messages=[
        {"role": "user", "content": "What is the weather in SF?"},
    ],
)
for message in runner:
    print(message)
    



"""payload shape

{
    question: string,
    noteStats: ???,
    posture: ???,
    correlations: ???,
    session_history: ???
}

"""