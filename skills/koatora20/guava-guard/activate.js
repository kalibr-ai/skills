// ═══════════════════════════════════════════
//  GuavaGuard ASI Edition — activate.html
//  Security-hardened dApp frontend
//  
//  SECURITY PROPERTIES:
//  - Zero backend, zero tracking, zero cookies
//  - ethers.js self-hosted with SRI hash
//  - CSP: default-src 'none', script-src 'self'
//  - Exact-amount approve only (no unlimited)
//  - All contract addresses hardcoded (immutable)
//  - Chain ID verified before AND after transactions
//  - Input sanitization on all user inputs
//  - frame-ancestors 'none' (anti-clickjacking)
//  - All external links rel="noopener noreferrer"
//  - No eval(), no innerHTML, no document.write
// ═══════════════════════════════════════════

"use strict";

// ═══════════════════════════════════════════
//  Constants (HARDCODED — DO NOT MODIFY)
// ═══════════════════════════════════════════

const POLYGON_CHAIN_ID = 137n;
const POLYGON_CHAIN_ID_HEX = "0x89";
const GUAVA_TOKEN = "0x25cBD481901990bF0ed2ff9c5F3C0d4f743AC7B8";
const SOUL_REGISTRY_V2 = "0xecfa4e769050649aeedf727193690a696f65c3fc";
const REGISTRATION_COST = ethers.parseUnits("1000", 18);

// Strict address validation
function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidHash(hash) {
  return typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash);
}

function sanitizeText(str) {
  if (typeof str !== "string") return "";
  // Strip control chars, keep printable + common unicode
  return str.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 64);
}

// Verify hardcoded addresses are valid at load time
if (!isValidAddress(GUAVA_TOKEN) || !isValidAddress(SOUL_REGISTRY_V2)) {
  throw new Error("CRITICAL: Hardcoded contract addresses are invalid. Page may be compromised.");
}

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const REGISTRY_ABI = [
  "function registerSoul(bytes32 _hash, string _agentName)",
  "function verifySoul(address _agent, bytes32 _hash) view returns (bool)",
  "function getSoul(address _agent) view returns (bytes32 currentHash, string agentName, uint256 registeredAt, uint256 lastUpdated, uint256 guavaLocked, bytes32[] hashHistory)",
  "function registrationCost() view returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "function totalGuavaLocked() view returns (uint256)"
];

// ═══════════════════════════════════════════
//  State
// ═══════════════════════════════════════════

let provider = null;
let signer = null;
let userAddress = null;

// ═══════════════════════════════════════════
//  UI Helpers (safe — no innerHTML)
// ═══════════════════════════════════════════

function setStatus(msg, type) {
  const el = document.getElementById("status-msg");
  el.className = "status " + (type || "info");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function setStep(stepNum) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById("step" + i);
    el.className = "step" + (i < stepNum ? " done" : i === stepNum ? " active" : "");
  }
}

// ═══════════════════════════════════════════
//  Chain verification helper
// ═══════════════════════════════════════════

async function verifyChain() {
  if (!provider) throw new Error("No provider connected");
  const network = await provider.getNetwork();
  if (network.chainId !== POLYGON_CHAIN_ID) {
    throw new Error("Wrong network! Expected Polygon (137), got " + network.chainId + ". Please switch networks.");
  }
  return true;
}

// ═══════════════════════════════════════════
//  Wallet Detection (Phantom + MetaMask)
// ═══════════════════════════════════════════

function getEthereumProvider() {
  if (window.phantom?.ethereum) {
    return { provider: window.phantom.ethereum, name: "Phantom" };
  }
  if (window.ethereum) {
    const name = window.ethereum.isPhantom ? "Phantom" :
                 window.ethereum.isMetaMask ? "MetaMask" : "Wallet";
    return { provider: window.ethereum, name };
  }
  return null;
}

// Check wallet on page load — retry multiple times for slow extensions
(function checkWalletOnLoad() {
  var attempts = 0;
  var maxAttempts = 10;
  function check() {
    attempts++;
    if (getEthereumProvider()) {
      document.getElementById("no-wallet-warning").style.display = "none";
      document.getElementById("btn-connect").disabled = false;
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(check, 500);
    } else {
      document.getElementById("no-wallet-warning").style.display = "block";
      document.getElementById("btn-connect").disabled = true;
    }
  }
  setTimeout(check, 300);
})();

// ═══════════════════════════════════════════
//  Step 1: Connect Wallet
// ═══════════════════════════════════════════

async function connectWallet() {
  try {
    setStatus("Detecting wallet...", "info");

    const detected = getEthereumProvider();
    if (!detected) {
      setStatus("No wallet found. Install Phantom or MetaMask.", "error");
      return;
    }

    await detected.provider.request({ method: "eth_requestAccounts" });

    // Switch to Polygon
    try {
      await detected.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_CHAIN_ID_HEX }]
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await detected.provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: POLYGON_CHAIN_ID_HEX,
            chainName: "Polygon Mainnet",
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
            rpcUrls: ["https://polygon-rpc.com"],
            blockExplorerUrls: ["https://polygonscan.com"]
          }]
        });
      } else {
        throw switchErr;
      }
    }

    provider = new ethers.BrowserProvider(detected.provider);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    // Validate address format
    if (!isValidAddress(userAddress)) {
      throw new Error("Invalid wallet address returned.");
    }

    // Verify we're actually on Polygon
    await verifyChain();

    // Update UI
    document.getElementById("wallet-info").textContent =
      detected.name + ": " + userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
    document.getElementById("btn-connect").textContent = "✅ Connected";
    document.getElementById("btn-connect").disabled = true;
    document.getElementById("no-wallet-warning").style.display = "none";

    // Check $GUAVA balance
    const guava = new ethers.Contract(GUAVA_TOKEN, ERC20_ABI, provider);
    const balance = await guava.balanceOf(userAddress);
    const balanceNum = Number(ethers.formatUnits(balance, 18));

    if (balance < REGISTRATION_COST) {
      setStatus("Insufficient $GUAVA. You have " + balanceNum.toLocaleString() + " but need 1,000.", "error");
      return;
    }

    // Check existing allowance
    const allowance = await guava.allowance(userAddress, SOUL_REGISTRY_V2);
    if (allowance >= REGISTRATION_COST) {
      setStatus("Balance: " + balanceNum.toLocaleString() + " $GUAVA ✅ Already approved!", "info");
      document.getElementById("btn-approve").textContent = "✅ Already Approved";
      document.getElementById("btn-approve").disabled = true;
      document.getElementById("btn-register").disabled = false;
      setStep(3);
    } else {
      setStatus("Balance: " + balanceNum.toLocaleString() + " $GUAVA ✅", "info");
      document.getElementById("btn-approve").disabled = false;
      setStep(2);
    }

    // Check if already registered
    const registry = new ethers.Contract(SOUL_REGISTRY_V2, REGISTRY_ABI, provider);
    try {
      const soul = await registry.getSoul(userAddress);
      if (soul.registeredAt > 0n) {
        setStatus("⚠️ This wallet already has a registered soul (\"" + sanitizeText(soul.agentName) + "\"). Use updateSoul() to change your hash.", "error");
        document.getElementById("btn-register").disabled = true;
        document.getElementById("btn-approve").disabled = true;
        return;
      }
    } catch (e) {
      // Not registered, expected
    }

  } catch (err) {
    setStatus("Connection failed: " + (err.message || "Unknown error"), "error");
    console.error("connectWallet error:", err);
  }
};

// ═══════════════════════════════════════════
//  Step 2: Approve $GUAVA (exact amount only)
// ═══════════════════════════════════════════

async function approveGuava() {
  try {
    await verifyChain();
    setStatus("Requesting approval for exactly 1,000 $GUAVA...", "info");
    document.getElementById("btn-approve").disabled = true;

    const guava = new ethers.Contract(GUAVA_TOKEN, ERC20_ABI, signer);

    // SECURITY: Approve EXACT amount only. Never MaxUint256.
    const tx = await guava.approve(SOUL_REGISTRY_V2, REGISTRATION_COST);

    setStatus("Approval tx sent (" + tx.hash.slice(0, 10) + "...). Waiting for confirmation...", "info");
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error("Approval transaction reverted on-chain.");
    }

    // Re-verify chain after tx
    await verifyChain();

    setStatus("✅ Approved! Now register your soul.", "success");
    document.getElementById("btn-approve").textContent = "✅ Approved";
    document.getElementById("btn-register").disabled = false;
    setStep(3);

  } catch (err) {
    setStatus("Approval failed: " + (err.message || "Unknown error"), "error");
    document.getElementById("btn-approve").disabled = false;
    console.error("approveGuava error:", err);
  }
};

// ═══════════════════════════════════════════
//  Step 3: Register Soul
// ═══════════════════════════════════════════

async function registerSoul() {
  try {
    await verifyChain();

    // Sanitize and validate inputs
    const rawHash = document.getElementById("input-hash").value;
    // Aggressively clean: strip all non-hex, non-0x chars
    const hash = rawHash.replace(/[^0-9a-fA-Fx]/g, "").trim();
    const rawName = document.getElementById("input-name").value;
    const name = sanitizeText(rawName);

    if (!isValidHash(hash)) {
      setStatus("Invalid hash. Must be 0x + 64 hex characters (SHA-256). Got length: " + hash.length, "error");
      return;
    }
    if (!name || name.length === 0) {
      setStatus("Agent name is required.", "error");
      return;
    }
    if (name.length > 64) {
      setStatus("Agent name too long (max 64 chars).", "error");
      return;
    }

    // Double-check allowance before sending register tx
    const guava = new ethers.Contract(GUAVA_TOKEN, ERC20_ABI, provider);
    const allowance = await guava.allowance(userAddress, SOUL_REGISTRY_V2);
    if (allowance < REGISTRATION_COST) {
      setStatus("Allowance insufficient. Please approve $GUAVA first.", "error");
      document.getElementById("btn-register").disabled = true;
      setStep(2);
      return;
    }

    setStatus("Registering soul on-chain...", "info");
    document.getElementById("btn-register").disabled = true;

    const registry = new ethers.Contract(SOUL_REGISTRY_V2, REGISTRY_ABI, signer);
    const tx = await registry.registerSoul(hash, name);

    setStatus("Tx sent (" + tx.hash.slice(0, 10) + "...). Waiting for confirmation...", "info");
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error("Registration transaction reverted on-chain.");
    }

    // Verify chain didn't change during transaction
    await verifyChain();

    // On-chain verification: confirm the soul was actually registered
    const registryRead = new ethers.Contract(SOUL_REGISTRY_V2, REGISTRY_ABI, provider);
    const isVerified = await registryRead.verifySoul(userAddress, hash);
    if (!isVerified) {
      throw new Error("On-chain verification failed after registration. Transaction may have been front-run.");
    }

    // Show success
    document.getElementById("main-flow").style.display = "none";
    const successBox = document.getElementById("success-box");
    successBox.style.display = "block";

    const txLink = document.getElementById("tx-link");
    const txHash = receipt.hash;
    if (isValidHash(txHash)) {
      txLink.href = "https://polygonscan.com/tx/" + txHash;
      txLink.textContent = "View on PolygonScan: " + txHash;
    } else {
      txLink.textContent = "Transaction confirmed.";
      txLink.removeAttribute("href");
    }

  } catch (err) {
    setStatus("Registration failed: " + (err.message || "Unknown error"), "error");
    document.getElementById("btn-register").disabled = false;
    console.error("registerSoul error:", err);
  }
};

// ═══════════════════════════════════════════
//  Bind event listeners (CSP-safe, no inline handlers)
// ═══════════════════════════════════════════

function bindButtons() {
  document.getElementById("btn-connect").addEventListener("click", connectWallet);
  document.getElementById("btn-approve").addEventListener("click", approveGuava);
  document.getElementById("btn-register").addEventListener("click", registerSoul);
}

// Script is loaded at end of body, DOM is guaranteed ready
bindButtons();

// ═══════════════════════════════════════════
//  Network change listener
// ═══════════════════════════════════════════
(function listenNetworkChanges() {
  const detected = getEthereumProvider();
  if (detected && detected.provider.on) {
    detected.provider.on("chainChanged", function(chainId) {
      if (chainId !== POLYGON_CHAIN_ID_HEX) {
        setStatus("⚠️ Network changed! Please switch back to Polygon.", "error");
        document.getElementById("btn-approve").disabled = true;
        document.getElementById("btn-register").disabled = true;
      }
    });
    detected.provider.on("accountsChanged", function() {
      // Force full reload on account change to prevent stale state
      window.location.reload();
    });
  }
})();