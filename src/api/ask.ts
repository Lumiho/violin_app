import { getNoteStats } from "../features/stats";
import { postureState } from "../types";


// frontend function to call the backend API for asking questions about posture and note stats
export async function ask(): Promise<string> {

	const response = await fetch('/api/ask',
	{
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		// payload
		body: JSON.stringify({
			question: "Where am I struggling?",
			noteStats: getNoteStats(),
			posture: postureState
		})
	})

	const data = await response.json();
	return data.response;
}