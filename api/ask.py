from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()  # Load from .env file

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from Vite dev server

# Configure Gemini with API key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Create the model
model = genai.GenerativeModel("gemini-2.0-flash")

TOOLS_SCHEMA = """
	You have these tools available:
	- setDrone(note, volume): Set the practice drone. note is like "A4", "G3", "D4". volume is 0-100.
	- toggleDrone(enabled): Turn drone on (true) or off (false).

	Return valid JSON only, no markdown:
	{"response": "your advice to the student", "actions": [{"tool": "toolName", "args": {...}}]}

	If no action needed, use empty actions array: {"response": "...", "actions": []}
"""

@app.route('/api/ask', methods=['POST'])
def ask():
	data = request.get_json()
	question = data.get('question')
	noteStats = data.get('noteStats')
	posture = data.get('posture')
	droneState = data.get('droneState', {})

	prompt = f"""You are a violin coach analyzing a student's practice session.
	{TOOLS_SCHEMA}

	Current State:
	- Drone: {droneState}
	- Note Statistics: {noteStats}
	- Posture: {posture}

	Student asks: {question}

	Analyze their data. If they're struggling with a note, consider turning on a drone to help.
	Respond with JSON only."""

	try:
		response = model.generate_content(prompt)
		response_text = response.text.strip()
		# Try to parse as JSON, fallback to plain response
		try:
			result = json.loads(response_text)
		except json.JSONDecodeError:
			# LLM didn't return valid JSON, wrap it
			result = {"response": response_text, "actions": []}
	except Exception as e:
		result = {"response": f"Error: {str(e)}", "actions": []}

	return jsonify(result)


if __name__ == '__main__':
	app.run(debug=True)