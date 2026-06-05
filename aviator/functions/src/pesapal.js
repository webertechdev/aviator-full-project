const axios = require("axios");

const PESAPAL_KEY = "KLg8UrH2NzfTvfeC4DuDXBQo2OPohmgH";
const PESAPAL_SECRET = "EA1hRGKSXVrIdahZmOLE8uG3ZK8=";
// Switch to https://www.pesapal.com/api for production
const PESAPAL_BASE = "https://cybqa.pesapal.com/pesapalv3";

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await axios.post(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    consumer_key: PESAPAL_KEY,
    consumer_secret: PESAPAL_SECRET,
  }, { headers: { Accept: "application/json", "Content-Type": "application/json" } });
  _token = res.data.token;
  // Tokens valid ~5min, refresh at 4min
  _tokenExpiry = Date.now() + 4 * 60 * 1000;
  return _token;
}

async function registerIPN(callbackUrl) {
  const token = await getToken();
  const res = await axios.post(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    url: callbackUrl,
    ipn_notification_type: "POST",
  }, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  return res.data.ipn_id;
}

async function submitStkPush({ amount, currency, phoneNumber, description, callbackUrl, ipnId, referenceId }) {
  const token = await getToken();
  const payload = {
    id: referenceId,
    currency,
    amount,
    description,
    callback_url: callbackUrl,
    notification_id: ipnId,
    billing_address: {
      phone_number: phoneNumber,
      email_address: "",
      country_code: currency === "KES" ? "KE" : currency === "TZS" ? "TZ" : "UG",
      first_name: "Player",
      last_name: "",
    },
  };
  const res = await axios.post(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, payload, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  return res.data; // { order_tracking_id, redirect_url, ... }
}

async function submitPayout({ amount, currency, phoneNumber, referenceId, description, callbackUrl, ipnId }) {
  const token = await getToken();
  const payload = {
    id: referenceId,
    currency,
    amount,
    description,
    callback_url: callbackUrl,
    notification_id: ipnId,
    disbursement_account: {
      account_number: phoneNumber,
      account_name: "Player",
      account_type: "MPESA",
    },
  };
  const res = await axios.post(`${PESAPAL_BASE}/api/Transactions/SubmitDisbursementRequest`, payload, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  return res.data;
}

async function getTransactionStatus(orderTrackingId) {
  const token = await getToken();
  const res = await axios.get(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  return res.data;
}

module.exports = { getToken, registerIPN, submitStkPush, submitPayout, getTransactionStatus };
