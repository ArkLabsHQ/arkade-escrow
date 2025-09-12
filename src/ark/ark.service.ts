import { Injectable } from '@nestjs/common';

export interface ArkDeriveParams {
  senderXOnly: string;
  receiverXOnly: string;
  arbitratorXOnly: string;
  network: 'signet' | 'testnet' | 'mainnet';
}

@Injectable()
export class ArkService {
  async deriveEscrowAddress(p: ArkDeriveParams): Promise<string> {
    // Replace with real Ark SDK derivation. For now deterministic stub for tests.
    const short = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'none';
    return `ark1-${p.network}-${short(p.senderXOnly)}-${short(p.receiverXOnly)}-${short(p.arbitratorXOnly)}`;
  }
}
