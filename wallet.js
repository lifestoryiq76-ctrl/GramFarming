/**
 * wallet.js - Handles FaucetPay withdrawals and wallet interactions for Gram Farming
 */

// Sahi live backend deployment URL set kar diya gaya hai
const API_BASE_URL = "https://gramfarming-api.onrender.com";

/**
 * Function to handle withdrawal to FaucetPay
 * @param {string} userId - Telegram or Firebase User ID
 * @param {number} amount - Amount to withdraw
 * @param {string} cryptocurrency - Coin symbol (e.g., DGB, TRX, FEY)
 * @param {string} faucetpayEmail - User's FaucetPay linked email or address
 */
async function withdrawToFaucetPay(userId, amount, cryptocurrency, faucetpayEmail) {
    const withdrawalButton = document.getElementById("withdraw-btn");
    
    try {
        if (withdrawalButton) {
            withdrawalButton.disabled = true;
            withdrawalButton.innerText = "Processing...";
        }

        const response = await fetch(`${API_BASE_URL}/api/withdraw-faucetpay`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: userId,
                amount: amount,
                coin: cryptocurrency,
                to: faucetpayEmail
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Network error while connecting to FaucetPay API server");
        }

        // Success Handling
        showNotification("Withdrawal successful! Check your FaucetPay account.", "success");
        console.log("Withdrawal Success:", data);
        
        // Refresh balances or update UI here
        if (typeof updateBalanceUI === "function") {
            updateBalanceUI();
        }

    } catch (error) {
        console.error("FaucetPay Withdrawal Error:", error);
        showNotification(error.message, "error");
    } finally {
        if (withdrawalButton) {
            withdrawalButton.disabled = false;
            withdrawalButton.innerText = "Withdraw";
        }
    }
}

/**
 * Helper function to show UI notifications (Toast / Alert)
 */
function showNotification(message, type = "info") {
    const notificationContainer = document.getElementById("notification-container") || createNotificationContainer();
    
    const toast = document.createElement("div");
    toast.className = `toast-message ${type}`;
    toast.innerText = message;
    
    // Style configurations
    toast.style.padding = "10px 20px";
    toast.style.marginTop = "10px";
    toast.style.borderRadius = "5px";
    toast.style.color = "#fff";
    toast.style.backgroundColor = type === "error" ? "#ff4d4d" : "#4CAF50";
    toast.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    toast.style.zIndex = "9999";

    notificationContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function createNotificationContainer() {
    const container = document.createElement("div");
    container.id = "notification-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
    return container;
}
