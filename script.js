const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

document.getElementById("login").onclick = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  const result = await auth.signInWithPopup(provider);
  currentUser = result.user;
  document.getElementById("user-name").textContent = currentUser.displayName;
  document.getElementById("chat").style.display = "block";
};

async function encryptMessage(message, key) {
  const enc = new TextEncoder();
  const encoded = enc.encode(message);
  return crypto.subtle.encrypt({ name: "AES-GCM", iv: key.iv }, key.cryptoKey, encoded);
}

async function decryptMessage(cipherText, key) {
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: key.iv }, key.cryptoKey, cipherText);
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[🔒 رسالة مشفرة لا يمكن قراءتها]";
  }
}

function generateSymmetricKey() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
    .then(cryptoKey => ({ cryptoKey, iv }));
}

let keyPromise = generateSymmetricKey();

document.getElementById("send").onclick = async () => {
  const message = document.getElementById("message-input").value;
  const friendEmail = document.getElementById("friend-email").value;
  const key = await keyPromise;
  const cipherBuffer = await encryptMessage(message, key);
  const cipherArray = Array.from(new Uint8Array(cipherBuffer));
  const ivArray = Array.from(key.iv);

  db.collection("messages").add({
    from: currentUser.email,
    to: friendEmail,
    text: cipherArray,
    iv: ivArray,
    time: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("message-input").value = "";
};

db.collection("messages").orderBy("time").onSnapshot(snapshot => {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  snapshot.forEach(async doc => {
    const msg = doc.data();
    if (msg.to === currentUser?.email || msg.from === currentUser?.email) {
      const key = await keyPromise;
      const cipherBuffer = new Uint8Array(msg.text).buffer;
      key.iv = new Uint8Array(msg.iv);
      const text = await decryptMessage(cipherBuffer, key);
      container.innerHTML += `<p><b>${msg.from}:</b> ${text}</p>`;
    }
  });
});
