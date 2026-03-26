/* ==============================
    WhatsApp Helper
============================== */
export function buildWhatsAppLink({ orderId, kidName, type = "generic" }) {
    const base = "https://wa.me/5491156971231";

    let message = "";

    if (type === "paid") {
        message = `Hola Risas y Colores 🌈
Realicé el pago del pedido #${orderId} del uniforme de ${kidName} y quería coordinar la entrega.`;
    } else if (type === "ready") {
        message = `Hola Risas y Colores 🌈
Estoy consultando por el pedido #${orderId} del uniforme de ${kidName}.`;
    } else {
        message = `Hola Risas y Colores 🌈
Estoy consultando por el pedido #${orderId}.`;
    }

    return `${base}?text=${encodeURIComponent(message)}`;
}

/* ==============================
    Email Footer
============================== */
export function emailFooterHTML() {
    return `
        <p style="font-size:14px;color:#666;">
            Este es un mensaje automático, por favor no respondas a este correo.
        </p>

        <p>
            Gracias por confiar en Risas y Colores 🌈
        </p>
    `;
}

export function emailFooterText() {
    return `
Este es un mensaje automático, por favor no respondas a este correo.

Gracias por confiar en Risas y Colores 🌈
    `.trim();
}

/* ==============================
    WhatsApp Button
============================== */
export function buildWhatsAppButton(link) {
    return `
        <div style="margin:20px 0;">
            <a
                href="${link}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                    display:inline-block;
                    background:#25D366;
                    color:#fff;
                    text-decoration:none;
                    padding:10px 16px;
                    border-radius:999px;
                    font-weight:600;
                "
            >
                Escribir por WhatsApp
            </a>
        </div>
    `;
}