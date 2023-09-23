import { NextResponse } from 'next/server';
import Web3 from 'web3';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@vercel/kv';

interface keyPair {
  address: string;
  privateKey: string;
}

const { KV_REST_API_URL, KV_REST_API_TOKEN, ALCHEMY_URL, TELEGRAM_API_KEY } = process.env;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !ALCHEMY_URL || !TELEGRAM_API_KEY) {
  throw new Error('Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined');
}

const web3 = new Web3(ALCHEMY_URL)
const bot = new TelegramBot(TELEGRAM_API_KEY.trim());


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
  if (!ethAddress || !web3.utils.isAddress(ethAddress)) {
    const message = 'Address not understood';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse(id);
  }

  try {
    const balanceWei = await web3.eth.getBalance(ethAddress);
    const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
    
    const balanceWeiNumber = Number(balanceWei);
    const message = `✅ The balance for address: *"${ethAddress}"* is ${balanceEth} ETH\nHave a great day! 👋🏻`;
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });

    if (Number.isSafeInteger(balanceWeiNumber)) {
      return NextResponse.json(
        { balanceWei: balanceWeiNumber, balanceEth },
        {
          status: 200,
        }
      );
    } else {
    }
  } catch (error) {
    console.error(error);
    const message = 'Error fetching balance';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse(id);
  }
}

async function handleCommand(id: string, text: string, username: string = '') {
  let ethAddressOrEns = text.replace('@devconnect_griffith_bot', '').trim();
  let ethAddress = null;
  let keyPair: keyPair | null = null;
  if(username.length > 0) { keyPair = await kv.get(`user:${username}`); }

  switch (true) {
    case ethAddressOrEns.startsWith('/balanceaddr'):
      ethAddress = ethAddressOrEns.replace('/balanceaddr', '').trim();
      if (ethAddress.length > 0) {
        await returnBalance(ethAddress, id);
      } else if (keyPair?.address) {
        await returnBalance(keyPair?.address, id);
      }
      break;

    case ethAddressOrEns.startsWith('/balance'):
      ethAddressOrEns = ethAddressOrEns.replace('/balance', '').trim();
      if (ethAddressOrEns.length > 0) {
        ethAddress = Buffer.from(await web3.eth.ens.getAddress(ethAddressOrEns)).toString();
        await returnBalance(ethAddress, id);
      } else if (keyPair?.address) {
        await returnBalance(keyPair?.address, id);
      }
      break;

    case ethAddressOrEns.startsWith('/generate'):
      if(!keyPair) { 
        const account = web3.eth.accounts.create();
        keyPair = {
          address: account.address,
          privateKey: account.privateKey,
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
    if(entities && entities[0].type === 'bot_command') {
      return handleCommand(id, text, username);
    }
  } else if(body.channel_post) {
    const message = body.channel_post;
    const { chat: { id }, text, entities } = message;
    if(entities && entities[0].type === 'bot_command') {
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
