import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
});

export const mpPreference = new Preference(client);
export const mpPayment = new Payment(client);

