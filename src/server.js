import { Router } from 'itty-router';
import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';

class JsonResponse extends Response {
	constructor(body) {
		super(JSON.stringify(body), {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		});
	}
}

const router = Router();

// Handle incoming HTTP requests
router.get('/', (request, env) => {
	return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request, env) => {
	const { isValid, interaction } = await verifyDiscordRequest(request, env);
	if (!isValid || !interaction) {
		return new Response('Bad request signature.', { status: 401 });
	}

	if (interaction.type === InteractionType.PING) {
		return new JsonResponse({ type: InteractionResponseType.PONG });
	}

	if (interaction.type === InteractionType.APPLICATION_COMMAND) {
		switch (interaction.data.name.toLowerCase()) {
			case 'reset': {
				const now = new Date();
				now.setHours(now.getHours() - 1); //accounts for daylight saving. remove when est
				const currentDay = now.getDay();
				const daysUntilWednesday = (3 - currentDay + 7) % 7 || 7;

				const nextWednesday = new Date(now);
				nextWednesday.setDate(now.getDate() + daysUntilWednesday);
				nextWednesday.setHours(0, 0, 0, 0);

				const diffMs = nextWednesday - now;
				const diffSec = Math.floor(diffMs / 1000);
				const days = Math.floor(diffSec / 86400);
				const hours = Math.floor((diffSec % 86400) / 3600);
				const minutes = Math.floor((diffSec % 3600) / 60);
				const seconds = diffSec % 60;

				const responseText = `Next Wednesday is on ${nextWednesday.toDateString()}\nTime remaining: ${days}d ${hours}h ${minutes}m ${seconds}s`;

				return new JsonResponse({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: { content: responseText },
				});
			}
			default:
				return new JsonResponse({ error: 'Unknown command' }, { status: 400 });
		}
	}

	return new JsonResponse({ error: 'Unknown interaction type' }, { status: 400 });
});

router.all('*', () => new Response('Not Found.', { status: 404 }));

// Verify incoming requests from Discord
async function verifyDiscordRequest(request, env) {
	const signature = request.headers.get('x-signature-ed25519');
	const timestamp = request.headers.get('x-signature-timestamp');
	const body = await request.text();

	const isValid = signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));

	return {
		isValid,
		interaction: isValid ? JSON.parse(body) : null,
	};
}

// Send a message to the Discord channel
async function sendResetMessage(env) {
	const channelId = '1208161807684993034'; // Replace with your channel ID
	const messageContent = 'RESET';

	const payload = {
		content: messageContent,
	};

	const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
		method: 'POST',
		headers: {
			Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, // Replace with your bot's token
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		console.error('Failed to send message:', await response.text());
	} else {
		console.log('Message sent successfully.');
	}
}

// Cron trigger for every Wednesday at 1 AM GMT
export const scheduledEvent = {
	async scheduled(event, env) {
		// Send the reset message every Wednesday at 1 AM GMT
		await sendResetMessage(env);
	},
};

// Ensure the worker fetch method is defined
export default {
	fetch: router.fetch,
	scheduledEvent,
};
