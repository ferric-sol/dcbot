import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@vercel/kv';
import { createPublicClient, http, isAddress, formatEther } from 'viem'
import { gnosis } from 'viem/chains'
import { normalize } from 'viem/ens'
import { privateKeyToAccount } from 'viem/accounts'
import { generatePrivateKey } from 'viem/accounts'

interface KeyPair {
  address: string;
  privateKey: string;
}

const { KV_REST_API_URL, KV_REST_API_TOKEN, GNOSIS_URL, TELEGRAM_API_KEY } = process.env;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !GNOSIS_URL || !TELEGRAM_API_KEY) {
  throw new Error('Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined');
}

const bot = new TelegramBot(TELEGRAM_API_KEY.trim());

const transport = http(GNOSIS_URL);

const client = createPublicClient({
  chain: gnosis,
  transport,
})

const kv = createClient({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
});

async function sendErrorResponse(id: string) {
  const message = 'Invalid Ethereum address';
  await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
  return NextResponse.json(
    { error: message },
    {
      status: 200,
    }
  );
}

async function returnBalance(ethAddress: string, id: string) {
  if (!ethAddress || !isAddress(ethAddress)) {
    const message = 'Address not understood';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse(id);
  }

  try {
    const balanceWei = await client.getBalance({address: ethAddress});
    const balanceEth = formatEther(balanceWei);
    
    const balanceWeiNumber = Number(balanceWei);
    const message = `✅ The balance for address: *"${ethAddress}"* is ${balanceEth} xDAI\nHave a great day! 👋🏻`;
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });

    if (Number.isSafeInteger(balanceWeiNumber)) {
      return NextResponse.json(
        { balanceWei: balanceWeiNumber, balanceEth },
        {
          status: 200,
        }
      );
    } 
  } catch (error) {
    console.error(error);
    const message = 'Error fetching balance';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse(id);
  }
}

async function handleCommand(id: string, text: string, username: string = '') {
  let ethAddressOrEns = text.replace('@DCFruitBot', '').trim();
  ethAddressOrEns = ethAddressOrEns.replace(/^\//, '').trim();

  let ethAddress = null;
  let keyPair: KeyPair | null = null;
  if(username.length > 0) { keyPair = await kv.get(`user:${username}`); }

  switch (true) {

    case ethAddressOrEns.startsWith('balanceaddr'):
      ethAddress = ethAddressOrEns.replace('balanceaddr', '').trim();
      if (ethAddress.length > 0) {
        await returnBalance(ethAddress, id);
      } else if (keyPair?.address) {
        await returnBalance(keyPair?.address, id);
      }
      break;

    case ethAddressOrEns.startsWith('balance'):
      ethAddressOrEns = ethAddressOrEns.replace('balance', '').trim();
      if (ethAddressOrEns.length > 0) {
        const ensAddress = await client.getEnsAddress({ name: normalize(ethAddressOrEns) });
        if (ensAddress !== null) {
          await returnBalance(ensAddress, id);
        } else {
          return await sendErrorResponse(id);
        }
      } else if (keyPair?.address) {
        await returnBalance(keyPair?.address, id);
      }
      break;

    case ethAddressOrEns.startsWith('generate'):
      // No username, can't create an address
      // Don't do nothin
      if(username.length > 0) {
        if(!keyPair) {
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);

          keyPair = {
            address: account.address,
            privateKey: privateKey,
          };

          try {
            await kv.set(`user:${username}`, JSON.stringify(keyPair));
          } catch (error) {
            console.error('Error storing the key pair:', error);
          }
        }
        try {
          const message = `✅ Key pair generated successfully:\n- Address: ${keyPair.address}`;
          await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('Error sending message:', error);
        }
      }
      break;

    default:
      return await sendErrorResponse(id);
  }
  return NextResponse.json(
    { 
      status: 200,
    }
  );

}

export async function POST(request: Request) {
  const body = await request.json();
  if(body.message) { 
    const message = body.message 
    const { chat: { id }, text, entities, from: { username } } = message;
    if(entities && entities[0]?.type === 'bot_command') {
      return handleCommand(id, text, username);
    }
  } else if(body.channel_post) {
    const message = body.channel_post;
    const { chat: { id }, text, entities } = message;
    // If it was a bot_command or an @mention where the bot was mentioned
    // Respond, otherwise don't respond
    if(entities && (entities[0]?.type === 'bot_command' || entities[0]?.type === 'mention' && text.match(/\@DCFruitBot/))) {
      return handleCommand(id, text);
    }
  }

  // Ignore all other input
  return NextResponse.json(
    { 
      status: 200,
    }
  );

}
