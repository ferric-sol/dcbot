import { NextResponse } from 'next/server';
import express from 'express';
import Web3 from 'web3';
import TelegramBot from 'node-telegram-bot-api';

const app = express();

const web3 = new Web3('https://eth-mainnet.g.alchemy.com/v2/YN54Eaz5Mz5wsaGdqmEYjc2RGAExwREZ');
const bot = new TelegramBot('6341931544:AAEH6yep5M6mkSCto0WQSnK_IzoXaI-hMGw');

export async function POST(request: Request) {
  const body = await request.json();
  const { chat: { id }, text } = body.message;

  let ethAddressOrEns = text;
  ethAddressOrEns = ethAddressOrEns.replace('@devconnect_griffith_bot ', '');

  const ethAddress = Buffer.from(await web3.eth.ens.getAddress(ethAddressOrEns)).toString();


  if (!ethAddress || !web3.utils.isAddress(ethAddress)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      {
        status: 400,
      }
    );
  }

  try {
    const balanceWei = await web3.eth.getBalance(ethAddress);
    const balanceEth = web3.utils.fromWei(balanceWei, 'ether');

    // Convert balanceWei to a regular number (if it's safe to do so)
    const balanceWeiNumber = Number(balanceWei);
    if (Number.isSafeInteger(balanceWeiNumber)) {
      const message = `✅ The balance for address: *"${ethAddress}"* is ${balanceEth}\nHave a great day! 👋🏻`;
      await bot.sendMessage(id, message, {parse_mode: 'Markdown'});
      return NextResponse.json(
        { balanceWei: balanceWeiNumber, balanceEth },
        {
          status: 200,
        }
      );
    } else {
      // Handle the case where the balanceWei is too large for Number
      return NextResponse.json(
        { error: 'Balance is too large to convert to a number' },
        {
          status: 500,
        }
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Server error' },
      {
        status: 500,
      }
    );
  }
}
