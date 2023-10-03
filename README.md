## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Do a POST to [http://localhost:3000/api/webhook](http://localhost:3000/api/webhook) with your browser to see the result.

Eg payload from telegram bot api:

```
{
    "update_id": 63295307,
    "message": {
        "message_id": 44,
        "from": {
            "id": 1051154550,
            "is_bot": false,
            "first_name": "Ferric",
            "username": "pherric",
            "language_code": "en"
        },
        "chat": {
            "id": 1051154550,
            "first_name": "Ferric",
            "username": "pherric",
            "type": "private"
        },
        "date": 1696323343,
        "text": "/balance",
        "entities": [
            {
                "offset": 0,
                "length": 8,
                "type": "bot_command"
            }
        ]
    }
}
```

### Telegram Bot
The bot responds to commands defined in src/app/api/webhook/route.ts

### Hosting
The bot is hosted on vercel
