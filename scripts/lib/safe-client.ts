import Safe from "@safe-global/protocol-kit";
import { ethers } from "ethers";

export interface SafeTxItem {
  to: string;
  value: string;
  data: string;
  description?: string;
}

export interface ProposeResult {
  safeTxHash: string;
  safeAppUrl: string;
  owners: string[];
  nonce: number;
}

export interface SignatureStatus {
  confirmations: number;
  threshold: number;
  confirmedOwners: string[];
  pendingOwners: string[];
  isExecutable: boolean;
  isExecuted: boolean;
  transactionHash?: string;
}

export interface PendingTransaction {
  safeTxHash: string;
  nonce: number;
  to: string;
  value: string;
  submissionDate: string;
  confirmations: number;
  threshold: number;
  isExecutable: boolean;
  safeAppUrl: string;
}

const TX_SERVICE_URLS: Record<number, string> = {
  1: "https://safe-transaction-mainnet.safe.global",
  11155111: "https://safe-transaction-sepolia.safe.global",
  137: "https://safe-transaction-polygon.safe.global",
  42161: "https://safe-transaction-arbitrum.safe.global",
  10: "https://safe-transaction-optimism.safe.global",
  8453: "https://safe-transaction-base.safe.global",
};

export class SafeClient {
  private protocolKit!: Safe;
  private safeAddress: string;
  private chainId: number;
  private rpcUrl: string;
  private txServiceUrl: string;
  private signer!: ethers.Wallet;

  constructor(config: { safeAddress: string; chainId: number; rpcUrl: string }) {
    this.safeAddress = config.safeAddress;
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;

    const txServiceUrl = TX_SERVICE_URLS[config.chainId];
    if (!txServiceUrl) {
      throw new Error(`Unsupported chain ID: ${config.chainId}. Supported: ${Object.keys(TX_SERVICE_URLS).join(", ")}`);
    }
    this.txServiceUrl = txServiceUrl;
  }

  async init(signerPrivateKey: string): Promise<void> {
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(signerPrivateKey, provider);

    this.protocolKit = await Safe.init({
      provider: this.rpcUrl,
      signer: signerPrivateKey,
      safeAddress: this.safeAddress,
    });
  }

  async getCurrentNonce(): Promise<number> {
    return this.protocolKit.getNonce();
  }

  async getPendingTransactions(): Promise<{
    currentNonce: number;
    pendingTransactions: PendingTransaction[];
  }> {
    const currentNonce = await this.getCurrentNonce();
    const threshold = await this.protocolKit.getThreshold();

    const response = await fetch(
      `${this.txServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/?executed=false&nonce__gte=${currentNonce}&ordering=nonce`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pending transactions: ${response.status}`);
    }

    const data = await response.json();
    const pendingTxs: PendingTransaction[] = (data.results || []).map((tx: any) => ({
      safeTxHash: tx.safeTxHash,
      nonce: tx.nonce,
      to: tx.to,
      value: tx.value,
      submissionDate: tx.submissionDate,
      confirmations: tx.confirmations?.length || 0,
      threshold,
      isExecutable: (tx.confirmations?.length || 0) >= threshold,
      safeAppUrl: `https://app.safe.global/transactions/tx?safe=eth:${this.safeAddress}&id=multisig_${this.safeAddress}_${tx.safeTxHash}`,
    }));

    return { currentNonce, pendingTransactions: pendingTxs };
  }

  async proposeBatchTx(txs: SafeTxItem[], customNonce?: number): Promise<ProposeResult> {
    const transactions = txs.map((t) => ({
      to: t.to,
      value: t.value,
      data: t.data,
    }));

    const safeTransaction = await this.protocolKit.createTransaction({
      transactions,
      options: customNonce !== undefined ? { nonce: customNonce } : undefined,
    });

    const safeTxHash = await this.protocolKit.getTransactionHash(safeTransaction);
    const owners = await this.protocolKit.getOwners();
    const signerAddress = this.signer.address;

    // Sign with eth_sign (v + 4 adjustment for delegate)
    const signature = await this.signer.signMessage(ethers.getBytes(safeTxHash));
    const sig = ethers.Signature.from(signature);
    const adjustedV = sig.v + 4;
    const senderSignature = sig.r + sig.s.slice(2) + adjustedV.toString(16);

    const txData = safeTransaction.data;
    const payload = {
      to: txData.to,
      value: txData.value,
      data: txData.data,
      operation: txData.operation,
      safeTxGas: txData.safeTxGas,
      baseGas: txData.baseGas,
      gasPrice: txData.gasPrice,
      gasToken: txData.gasToken,
      refundReceiver: txData.refundReceiver,
      nonce: txData.nonce,
      contractTransactionHash: safeTxHash,
      sender: signerAddress,
      signature: senderSignature,
    };

    const response = await fetch(
      `${this.txServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to propose: ${response.status} ${errorText}`);
    }

    return {
      safeTxHash,
      safeAppUrl: `https://app.safe.global/transactions/tx?safe=eth:${this.safeAddress}&id=multisig_${this.safeAddress}_${safeTxHash}`,
      owners,
      nonce: txData.nonce,
    };
  }

  async checkSignatureStatus(safeTxHash: string): Promise<SignatureStatus> {
    const response = await fetch(
      `${this.txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`
    );
    if (!response.ok) {
      throw new Error(`Failed to get transaction: ${response.status}`);
    }
    const tx = await response.json();

    const threshold = await this.protocolKit.getThreshold();
    const owners = await this.protocolKit.getOwners();

    const confirmedOwners = tx.confirmations?.map((c: any) => c.owner) || [];
    const confirmedSet = new Set(confirmedOwners.map((o: string) => o.toLowerCase()));
    const pendingOwners = owners.filter((o) => !confirmedSet.has(o.toLowerCase()));

    return {
      confirmations: confirmedOwners.length,
      threshold,
      confirmedOwners,
      pendingOwners,
      isExecutable: confirmedOwners.length >= threshold,
      isExecuted: tx.isExecuted === true,
      transactionHash: tx.transactionHash || undefined,
    };
  }

  async executeTransaction(safeTxHash: string): Promise<string> {
    const response = await fetch(
      `${this.txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`
    );
    if (!response.ok) {
      throw new Error(`Failed to get transaction: ${response.status}`);
    }
    const tx = await response.json();

    const execResult = await this.protocolKit.executeTransaction(tx);
    const receipt = await execResult.transactionResponse?.wait();
    return receipt?.hash || execResult.hash;
  }

  async getOwners(): Promise<string[]> {
    return this.protocolKit.getOwners();
  }

  async getThreshold(): Promise<number> {
    return this.protocolKit.getThreshold();
  }

  getSafeAddress(): string {
    return this.safeAddress;
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }
}
