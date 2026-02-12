import {
    getHomeHeroPublic,
    getElJardinGalleryPublic,
    upsertHomeHeroAdmin,
    upsertElJardinGalleryAdmin,
} from "./content.service.js";

export async function getHomeHero(req, res, next) {
    try {
        const data = await getHomeHeroPublic();
        return res.json({ ok: true, ...data });
    } catch (e) {
        next(e);
    }
}

export async function getElJardinGallery(req, res, next) {
    try {
        const data = await getElJardinGalleryPublic();
        return res.json({ ok: true, ...data });
    } catch (e) {
        next(e);
    }
}

export async function putHomeHero(req, res, next) {
    try {
        const saved = await upsertHomeHeroAdmin(req.body);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}

export async function putElJardinGallery(req, res, next) {
    try {
        const saved = await upsertElJardinGalleryAdmin(req.body);
        return res.json({ ok: true, saved });
    } catch (e) {
        next(e);
    }
}
