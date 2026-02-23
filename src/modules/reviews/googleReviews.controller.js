import {
    getGoogleReviewsPublic,
    getGoogleReviewsAdmin,
    setGoogleReviewsUrlAdmin,
    createGoogleReviewAdmin,
    updateGoogleReviewAdmin,
    setGoogleReviewActiveAdmin,
    deleteGoogleReviewAdmin,
} from "./googleReviews.service.js";

export async function getPublic(req, res, next) {
    try {
        const data = await getGoogleReviewsPublic();
        return res.json({ ok: true, data });
    } catch (e) {
        next(e);
    }
}

export async function getAdmin(req, res, next) {
    try {
        const data = await getGoogleReviewsAdmin();
        return res.json({ ok: true, data });
    } catch (e) {
        next(e);
    }
}

export async function putUrl(req, res, next) {
    try {
        const saved = await setGoogleReviewsUrlAdmin(req.body?.googleReviewsUrl);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}

export async function postCreate(req, res, next) {
    try {
        const saved = await createGoogleReviewAdmin(req.body);
        return res.status(201).json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}

export async function putUpdate(req, res, next) {
    try {
        const saved = await updateGoogleReviewAdmin(req.params.id, req.body);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}

export async function patchActive(req, res, next) {
    try {
        const saved = await setGoogleReviewActiveAdmin(req.params.id, req.body?.active);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}

export async function del(req, res, next) {
    try {
        const saved = await deleteGoogleReviewAdmin(req.params.id);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}