from flask import Flask,jsonify,request
import os
from anthropic import Anthropic

app = Flask(__name__)

client = Anthropic(
	api_key=os.environ.get("ANTHROPIC_API_KEY"),
)

@app.route('/api/ask', methods = ['POST']) # flask needs a list for methods not a string remember
def ask():
	data = request.get_json() # get data from frontend first
	question = data.get('question')
	noteStats = data.get('noteStats') 
	posture = data.get('posture') 
 
	# anthropic sdk docs say this is how to send/receive.
	# here we ask our question to the llm and receive it as message var
	message = client.messages.create(
		max_tokens=1024,
		messages=[
			{
				"role": "user",
				"content": f"""
							Question: {question}
							-	NoteStats: {noteStats}
							-	Posture: {posture}
							""",
			}
		],
		model="claude-sonnet-4-20250514",
	)
	try:
		response_text = message.content[0].text
	except (IndexError, AttributeError):
		response_text = "Error: No response generated"
	
	return jsonify({"response": response_text})     


"""  What I initially thought we'd use to get a response:

data = request.get_json() # data will have multiple fields
answer = data.get('answer')
return jsonify({"Answer: " + answer}) # jsonify returns json from dict {}
"""


"""
response format after using messages.client.create():
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
	{
	  "type": "text",
	  "text": "Hello!"
	}
  ],
  "model": "claude-opus-5",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
	"input_tokens": 12,
	"output_tokens": 6
  }
}

"""