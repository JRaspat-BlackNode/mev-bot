import { Keypair } from '@solana/web3.js';
import { config } from '../config.js';
import { geyserClient as jitoGeyserClient } from 'jito-ts';
import { SearcherClient, searcherClient as jitoSearcherClient } from 'jito-ts/dist/sdk/block-engine/searcher.js';
import * as fs from 'fs';

// Constants and configurations
const BLOCK_ENGINE_URLS = config.get('block_engine_urls');
const AUTH_KEYPAIR_PATH = config.get('auth_keypair_path');
const GEYSER_URL = config.get('geyser_url');
const GEYSER_ACCESS_TOKEN = config.get('geyser_access_token');

// Asynchronous function to read and parse the authentication keypair
async function readAuthKeypair(filePath: string): Promise<Keypair> {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const decodedKey = new Uint8Array(JSON.parse(fileContent) as number[]);
    return Keypair.fromSecretKey(decodedKey);
  } catch (error) {
    console.error('Error reading authentication keypair:', error);
    throw error;
  }
}

// Asynchronously initialize all searcher clients
async function initializeSearcherClients(urls: string[], keypair: Keypair): Promise<SearcherClient[]> {
  const clientOptions = { 'grpc.keepalive_timeout_ms': 4000 };
  const clients = urls.map(url => jitoSearcherClient(url, keypair, clientOptions));
  return Promise.all(clients);
}

async function initializeClients() {
  try {
    const keypair = await readAuthKeypair(AUTH_KEYPAIR_PATH);
    const searcherClients = await initializeSearcherClients(BLOCK_ENGINE_URLS, keypair);
    const geyserClient = jitoGeyserClient(GEYSER_URL, GEYSER_ACCESS_TOKEN, { 'grpc.keepalive_timeout_ms': 4000 });

    // Assuming the first block engine is the closest one
    const primarySearcherClient = searcherClients[0];
    return { primarySearcherClient, searcherClients, geyserClient };
  } catch (error) {
    console.error('Error initializing clients:', error);
    throw error;
  }
}

export { initializeClients };
