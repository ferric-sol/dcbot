import { NextResponse } from 'next/server';
import Web3 from 'web3';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@vercel/kv';

const { KV_REST_API_URL, KV_REST_API_TOKEN, ALCHEMY_URL, TELEGRAM_API_KEY } = process.env;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !ALCHEMY_URL || !TELEGRAM_API_KEY) {
  throw new Error('Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined');
}

const web3 = new Web3(ALCHEMY_URL)
const bot = new TelegramBot(TELEGRAM_API_KEY)


const kv = createClient({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
});

function sendErrorResponse() {
  return NextResponse.json(
    { error: 'Invalid Ethereum address' },
    {
      status: 200,
    }
  );
}

async function handleCommand(id: any, text: string, username: string) {

  let ethAddressOrEns = text.replace('@devconnect_griffith_bot ', '').trim();
  let ethAddress = null;

  switch (true) {
    case ethAddressOrEns.startsWith('/balanceaddr'):
      ethAddressOrEns = ethAddressOrEns.replace('/balanceaddr', '').trim();
      if (!ethAddressOrEns) {
        return sendErrorResponse();
      }
      ethAddress = ethAddressOrEns;
      break;

    case ethAddressOrEns.startsWith('/balance'):
      ethAddressOrEns = ethAddressOrEns.replace('/balance', '').trim();
      if (ethAddressOrEns.length <= 0) {
        return sendErrorResponse();
      }
      ethAddress = Buffer.from(await web3.eth.ens.getAddress(ethAddressOrEns)).toString();
      break;

    case ethAddressOrEns.startsWith('/generate'):
      const account = web3.eth.accounts.create();
      const keyPair = {
        address: account.address,
        privateKey: account.privateKey,
      };

      try {
        await kv.set(`user:${username}`, JSON.stringify(keyPair), { ex: 100, nx: true });
      } catch (error) {
        console.error('Error storing the key pair:', error);
        return NextResponse.json(
          { error: 'Error storing the key pair' },
          {
            status: 500,
          }
        );
      }

      await bot.sendMessage(id, `✅ Key pair generated successfully:\n- Address: ${keyPair.address}\n- Private Key: ${keyPair.privateKey}`, { parse_mode: 'Markdown' });
      return NextResponse.json(
        { keyPair },
        {
          status: 200,
        }
      );
      break;

    default:
      return sendErrorResponse();
  }

  if (!ethAddress || !web3.utils.isAddress(ethAddress)) {
    const message = 'Address not understood';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse();
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
      return NextResponse.json(
        { 
          message: 'Balance is too large to convert to a number',
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error(error);
    const message = 'Error fetching balance';
    await bot.sendMessage(id, message, { parse_mode: 'Markdown' });
    return sendErrorResponse();
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { chat: { id }, text, entities, message: { from: { username } } } = body;

  if(entities && entities[0].type === 'bot_command') {
    return handleCommand(id, text, username);
  }

  // ... (other logic for POST function, if any)
}
