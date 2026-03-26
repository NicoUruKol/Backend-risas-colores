import admin from "firebase-admin";
import { db } from "../../config/firebase.js";

/* ==============================
Config
============================== */
const ORDERS_COL = "orders";

const normalize = (v) => (v ?? "").toString().trim();

const hasEmailConfig = () => {
    return Boolean(
        process.env.EMAIL_PROVIDER &&
        process.env.EMAIL_FROM &&
        process.env.GARDEN_NOTIFICATION_EMAIL
    );
};

/* ==============================
Helpers
============================== */
const money = (n) => {
    return Number(n || 0).toLocaleString("es-AR");
};

const buildItemsHtml = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
        return "<p>No hay productos en el pedido.</p>";
    }

    const rows = items
        .map((item) => {
            return `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${item.name || "-"}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${item.size || "-"}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${item.qty || 0}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">$${money(item.unitPrice)}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">$${money(item.lineTotal)}</td>
                </tr>
            `;
        })
        .join("");

    return `
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Producto</th>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Talle</th>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Cant.</th>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Precio</th>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
};

const buildItemsText = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
        return "No hay productos en el pedido.";
    }

    return items
        .map((item) => {
            return `- ${item.name || "-"} | Talle: ${item.size || "-"} | Cant: ${item.qty || 0} | Unit: $${money(item.unitPrice)} | Subtotal: $${money(item.lineTotal)}`;
        })
        .join("\n");
};

/* ==============================
Email provider
============================== */
const sendWithResend = async ({ to, subject, html, text }) => {
    const apiKey = normalize(process.env.RESEND_API_KEY);
    if (!apiKey) {
        throw new Error("Falta RESEND_API_KEY");
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text,
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(data?.message || `Resend error HTTP ${res.status}`);
    }

    return data;
};

const sendEmail = async ({ to, subject, html, text }) => {
    const provider = normalize(process.env.EMAIL_PROVIDER).toLowerCase();

    if (provider === "resend") {
        return sendWithResend({ to, subject, html, text });
    }

    throw new Error(`Proveedor de email no soportado: ${provider || "sin definir"}`);
};

/* ==============================
Templates
============================== */
const buildGardenPaidEmail = (order) => {
    const familyName = order?.family?.adultName || order?.customer?.name || "Familia";
    const kidName = order?.family?.kidName || "Sin dato";
    const email = order?.customer?.email || "-";
    const phone = order?.customer?.phone || "-";
    const total = money(order?.total);

    const subject = `Nuevo pedido pagado #${order.id}`;

    const html = `
        <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
            <h2>Nuevo pedido pagado</h2>
            <p>Se acreditó un nuevo pedido en la tienda.</p>

            <p><b>Pedido:</b> #${order.id}</p>
            <p><b>Adulto responsable:</b> ${familyName}</p>
            <p><b>Niño/a:</b> ${kidName}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Teléfono:</b> ${phone}</p>
            <p><b>Estado de pago:</b> ${order.status}</p>
            <p><b>Estado de entrega:</b> ${order.deliveryStatus}</p>

            <div style="margin:18px 0;">
                ${buildItemsHtml(order.items)}
            </div>

            <p style="font-size:16px;"><b>Total:</b> $${total}</p>
        </div>
    `;

    const text = `
Nuevo pedido pagado

Pedido: #${order.id}
Adulto responsable: ${familyName}
Niño/a: ${kidName}
Email: ${email}
Teléfono: ${phone}
Estado de pago: ${order.status}
Estado de entrega: ${order.deliveryStatus}

${buildItemsText(order.items)}

Total: $${total}
    `.trim();

    return { subject, html, text };
};

const buildFamilyPaidEmail = (order) => {
    const familyName = order?.family?.adultName || order?.customer?.name || "Familia";
    const kidName = order?.family?.kidName || "tu peque";
    const total = money(order?.total);

    const subject = `Confirmación de tu pedido #${order.id}`;

    const html = `
        <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
            <h2>¡Gracias por tu compra, ${familyName}! 🎉</h2>

            <p>
                Tu pago fue aprobado correctamente y ya registramos el pedido del uniforme de <b>${kidName}</b>.
            </p>

            <p><b>Número de pedido:</b> #${order.id}</p>

            <div style="margin:18px 0;">
                ${buildItemsHtml(order.items)}
            </div>

            <p style="font-size:16px;"><b>Total abonado:</b> $${total}</p>

            <p>
                Para coordinar la entrega o hacer cualquier consulta, escribinos por 
                <b>WhatsApp</b> 👇
            </p>

            <!-- Botón WhatsApp -->
            <div style="margin:20px 0;">
                <a
                href="https://wa.me/5491156971231?text=Hola%20Risas%20y%20Colores%20%F0%9F%8C%88%0ARealic%C3%A9%20el%20pago%20del%20pedido%20%23${order.id}%20del%20uniforme%20de%20${kidName}%20y%20quer%C3%ADa%20coordinar%20la%20entrega."
                target="_blank"
                rel="noopener noreferrer"
                style="
                    display:inline-flex;
                    align-items:center;
                    gap:10px;
                    background:#25D366;
                    color:#fff;
                    text-decoration:none;
                    padding:10px 16px;
                    border-radius:999px;
                    font-weight:600;
                "
                >
                <img 
                    src="https://cdn-icons-png.flaticon.com/512/733/733585.png" 
                    alt="WhatsApp"
                    style="width:20px;height:20px;"
                />
                Escribir por WhatsApp
                </a>
            </div>

            <p style="font-size:14px;color:#666;">
                Este es un mensaje automático, por favor no respondas a este correo.
            </p>

            <p>
                Gracias por confiar en Risas y Colores 🌈
            </p>
        </div>
        `;
    const text = `
        ¡Gracias por tu compra, ${familyName}! 🎉

        Tu pago fue aprobado correctamente y ya registramos el pedido del uniforme de ${kidName}.

        Número de pedido: #${order.id}

        ${buildItemsText(order.items)}

        Total abonado: $${total}

        Para coordinar la entrega o hacer cualquier consulta, escribinos por WhatsApp:
        https://wa.me/5491156971231?text=Hola%20Risas%20y%20Colores%20%F0%9F%8C%88%0ARealic%C3%A9%20el%20pago%20del%20pedido%20%23${order.id}%20del%20uniforme%20de%20${kidName}%20y%20quer%C3%ADa%20coordinar%20la%20entrega.

        Este es un mensaje automático, por favor no respondas a este correo.

        Gracias por confiar en Risas y Colores 🌈
        `.trim();

    return { subject, html, text };
};

const buildReadyForPickupEmail = (order) => {
    const familyName = order?.family?.adultName || order?.customer?.name || "Familia";
    const kidName = order?.family?.kidName || "tu peque";

    const subject = `Tu pedido #${order.id} ya está listo para retirar`;

    const html = `
        <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
            <h2>¡Hola, ${familyName}!</h2>

            <p>
                Te avisamos que el pedido del uniforme de <b>${kidName}</b> ya está 
                <b>listo para retirar</b>.
            </p>

            <p><b>Número de pedido:</b> #${order.id}</p>

            <div style="margin:18px 0;">
                ${buildItemsHtml(order.items)}
            </div>

            <p>
                Para coordinar el retiro o hacer cualquier consulta, escribinos por 
                <b>WhatsApp</b> 👇
            </p>

            <!-- Botón WhatsApp -->
            <div style="margin:20px 0;">
                <a
                href="https://wa.me/5491156971231?text=Hola%20Risas%20y%20Colores%20%F0%9F%8C%88%0AEstoy%20consultando%20por%20el%20pedido%20%23${order.id}%20del%20uniforme%20de%20${kidName}."
                target="_blank"
                rel="noopener noreferrer"
                style="
                    display:inline-flex;
                    align-items:center;
                    gap:10px;
                    background:#25D366;
                    color:#fff;
                    text-decoration:none;
                    padding:10px 16px;
                    border-radius:999px;
                    font-weight:600;
                "
                >
                <img 
                    src="https://cdn-icons-png.flaticon.com/512/733/733585.png" 
                    alt="WhatsApp"
                    style="width:20px;height:20px;"
                />
                Escribir por WhatsApp
                </a>
            </div>

            <p style="font-size:14px;color:#666;">
                Este es un mensaje automático, por favor no respondas a este correo.
            </p>

            <p>
                Gracias por confiar en Risas y Colores 🌈
            </p>
        </div>
    `;

    const text = `
        ¡Hola, ${familyName}!

        Te avisamos que el pedido del uniforme de ${kidName} ya está listo para retirar.

        Número de pedido: #${order.id}

        ${buildItemsText(order.items)}

        Para coordinar el retiro o hacer cualquier consulta, escribinos por WhatsApp:
        https://wa.me/5491156971231?text=Hola%20Risas%20y%20Colores%20%F0%9F%8C%88%0AEstoy%20consultando%20por%20el%20pedido%20%23${order.id}%20del%20uniforme%20de%20${kidName}.

        Este es un mensaje automático, por favor no respondas a este correo.

        Gracias por confiar en Risas y Colores 🌈
        `.trim();

    return { subject, html, text };
};

/* ==============================
Notification status
============================== */
const markNotificationSent = async (orderId, key) => {
    const patch = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [`notifications.${key}`]: true,
        [`notifications.${key}At`]: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(ORDERS_COL).doc(orderId).update(patch);
};

/* ==============================
Public actions
============================== */
export const sendPaidOrderNotifications = async (order) => {
    if (!order?.id) return;

    if (!hasEmailConfig()) {
        console.warn("Email no configurado todavía. Se omiten notificaciones.");
        return;
    }

    const gardenAlreadySent = Boolean(order?.notifications?.gardenPaidEmailSent);
    const familyAlreadySent = Boolean(order?.notifications?.familyPaidEmailSent);

    if (!gardenAlreadySent) {
        const gardenEmail = buildGardenPaidEmail(order);

        await sendEmail({
            to: process.env.GARDEN_NOTIFICATION_EMAIL,
            subject: gardenEmail.subject,
            html: gardenEmail.html,
            text: gardenEmail.text,
        });

        await markNotificationSent(order.id, "gardenPaidEmailSent");
    }

    const familyEmailAddress = normalize(order?.customer?.email);

    if (!familyAlreadySent && familyEmailAddress) {
        const familyEmail = buildFamilyPaidEmail(order);

        await sendEmail({
            to: familyEmailAddress,
            subject: familyEmail.subject,
            html: familyEmail.html,
            text: familyEmail.text,
        });

        await markNotificationSent(order.id, "familyPaidEmailSent");
    }
};

export const sendReadyForPickupNotification = async (order) => {
    if (!order?.id) return;

    if (!hasEmailConfig()) {
        console.warn("Email no configurado todavía. Se omite notificación de listo para retirar.");
        return;
    }

    const alreadySent = Boolean(order?.notifications?.readyForPickupEmailSent);
    const familyEmailAddress = normalize(order?.customer?.email);

    if (alreadySent || !familyEmailAddress) {
        return;
    }

    const readyEmail = buildReadyForPickupEmail(order);

    await sendEmail({
        to: familyEmailAddress,
        subject: readyEmail.subject,
        html: readyEmail.html,
        text: readyEmail.text,
    });

    await markNotificationSent(order.id, "readyForPickupEmailSent");
};