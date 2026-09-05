import { getNoteStats } from "../features/stats";
import { postureState } from "../types";
import { setDroneNote, setDroneVolume, isDroneActive, toggleDrone } from "../features/drone";

interface CoachAction {
	tool: string;
	args: Record<string, unknown>;
}

interface CoachResponse {
	response: string;
	actions: CoachAction[];
}

function executeAction(action: CoachAction): void {
	const droneSelect = document.querySelector<HTMLSelectElement>('#drone-note');
	const volumeSlider = document.querySelector<HTMLInputElement>('#drone-volume');

	switch (action.tool) {
		case 'setDrone':
			if (action.args.note) {
				setDroneNote(action.args.note as string);
				if (droneSelect) droneSelect.value = action.args.note as string;
			}
			if (action.args.volume !== undefined) {
				setDroneVolume(action.args.volume as number);
				if (volumeSlider) volumeSlider.value = String(action.args.volume);
			}
			break;
		case 'toggleDrone':
			if (action.args.enabled !== undefined) {
				const shouldBeOn = action.args.enabled as boolean;
				if (shouldBeOn !== isDroneActive()) toggleDrone();
			}
			break;
	}
}

export async function ask(): Promise<string> {
	const postureData = postureState.lastUpdate > 0
		? postureState
		: { status: "Not tracked - camera not used" };

	const response = await fetch('http://localhost:5000/api/ask', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			question: "Where am I struggling?",
			noteStats: getNoteStats(),
			posture: postureData,
			droneState: {
				active: isDroneActive(),
				note: document.querySelector<HTMLSelectElement>('#drone-note')?.value
			}
		})
	});

	const data: CoachResponse = await response.json();

	// Execute any actions the coach requested
	for (const action of data.actions) {
		executeAction(action);
	}

	return data.response;
}