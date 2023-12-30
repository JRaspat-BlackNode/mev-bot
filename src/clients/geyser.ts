import { AccountInfo, PublicKey } from '@solana/web3.js';
import { GeyserClient as JitoGeyserClient } from 'jito-ts';
import { AccountUpdate, TimestampedAccountUpdate } from 'jito-ts/dist/gen/geyser/geyser.js';
import { logger } from '../logger.js';
import { geyserClient as jitoGeyserClient } from './jito.js';

type AccountUpdateCallback = (data: AccountInfo<Buffer>) => void;
type AccountSubscriptionHandlersMap = Map<string, AccountUpdateCallback[]>;

class GeyserAccountUpdateClient {
  private jitoClient: JitoGeyserClient;
  private seqs: Map<string, number>;
  private updateCallbacks: AccountSubscriptionHandlersMap;
  private closeCurrentSubscription: () => void;
  private publicKeyCache: Map<string, PublicKey>;

  constructor() {
    this.jitoClient = jitoGeyserClient;
    this.seqs = new Map();
    this.updateCallbacks = new Map();
    this.publicKeyCache = new Map();
    this.closeCurrentSubscription = () => {};
  }

  private getPublicKey(address: string): PublicKey {
    if (!this.publicKeyCache.has(address)) {
      this.publicKeyCache.set(address, new PublicKey(address));
    }
    return this.publicKeyCache.get(address)!;
  }

  private processUpdate(resp: TimestampedAccountUpdate) {
    if (!resp.accountUpdate) return;
    const accountUpdate: AccountUpdate = resp.accountUpdate;
    const address = this.getPublicKey(accountUpdate.pubkey).toBase58();

    if (accountUpdate.isStartup || (accountUpdate.seq <= this.seqs.get(address))) return;
    this.seqs.set(address, accountUpdate.seq);

    const callbacks = this.updateCallbacks.get(address);
    if (!callbacks) return;

    const accountInfo: AccountInfo<Buffer> = {
      data: Buffer.from(accountUpdate.data),
      executable: accountUpdate.isExecutable,
      lamports: accountUpdate.lamports,
      owner: this.getPublicKey(accountUpdate.owner),
    };
    callbacks.forEach(callback => callback(accountInfo));
  }

  private subscribe() {
    const accounts = Array.from(this.updateCallbacks.keys()).map(this.getPublicKey.bind(this));
    logger.debug(`Subscribing to ${accounts.length} accounts`);
    this.closeCurrentSubscription();
    this.closeCurrentSubscription = this.jitoClient.onAccountUpdate(
      accounts,
      this.processUpdate.bind(this),
      (error) => {
        logger.error(error);
        throw error;
      },
    );
  }

  addSubscriptions(subscriptions: AccountSubscriptionHandlersMap) {
    subscriptions.forEach((callbacks, address) => {
      const currentCallbacks = this.updateCallbacks.get(address) || [];
      this.updateCallbacks.set(address, currentCallbacks.concat(callbacks));
      this.seqs.set(address, 0);
    });
    this.subscribe();
  }
}

// Similar optimizations for GeyserProgramUpdateClient...

const geyserAccountUpdateClient = new GeyserAccountUpdateClient();

export {
  geyserAccountUpdateClient,
  AccountSubscriptionHandlersMap,
  GeyserProgramUpdateClient,
};
