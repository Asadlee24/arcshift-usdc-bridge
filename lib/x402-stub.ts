// Stub module to prevent build errors when optional x402 dependencies are evaluated by bundlers (Turbopack / Webpack)
export const registerExactEvmScheme = () => {};
export const UptoEvmScheme = {};
export const ExactEvmScheme = {};
export const ExactSvmScheme = {};
export const registerExactSvmScheme = () => {};
export const fromCdpSmartWallet = () => {};
export const cdpSolanaAccountToSvmSigner = () => {};
export const toClientEvmSigner = () => {};

const defaultExport = {
  registerExactEvmScheme,
  UptoEvmScheme,
  ExactEvmScheme,
  ExactSvmScheme,
  registerExactSvmScheme,
  fromCdpSmartWallet,
  cdpSolanaAccountToSvmSigner,
  toClientEvmSigner,
};

export default defaultExport;
