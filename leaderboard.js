const API_URL = "https://script.google.com/macros/s/AKfycbwc9moKwF4SbZ6YLGYyEzRxCN9CMpVFZjDFp_gb_wr3NBvlN24XyG9vnAQgx7hy1tA/exec";
const SECRET_SALT = "0987654321";

class Leaderboard {
    static async submitScore(username, score) {
        const hashString = username + score + SECRET_SALT;
        const hash = this.hash(hashString);

        console.log("Leaderboard Debug:", {
            username,
            score,
            hashString,
            hash
        });

        const payload = {
            username,
            score,
            hash,
            groupTag: "global"
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                mode: "cors", // Explicitly enable CORS
                headers: {
                    "Content-Type": "text/plain", // Минимальный заголовок для обхода CORS Preflight
                },
                body: JSON.stringify(payload),
                redirect: "follow" // Essential for Google Apps Script
            });
            return await response.json();
        } catch (e) {
            console.error("Leaderboard Error:", e);
            return null;
        }
    }

    // platform-independent 32-bit hash (djb2)
    static hash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; // Keep it 32-bit
        }
        return (hash >>> 0).toString(16); // Always positive hex
    }
}

window.Leaderboard = Leaderboard;
