// src/modules/media/media.controller.js
import {
    listImages,
    uploadImage,
    deleteImage,
    assertAllowedFolder,
} from "./media.service.js";

export async function listMedia(req, res, next) {
    try {
        const { folder, max, next_cursor } = req.query;

        const data = await listImages({ folder, max, next_cursor });
        return res.json({ ok: true, ...data });
    } catch (e) {
        next(e);
    }
}

export async function uploadMedia(req, res, next) {
    try {
        const { folder } = req.query;
        assertAllowedFolder(folder);

        if (!req.file?.buffer) {
        return res.status(400).json({ ok: false, message: "Falta archivo (file)" });
        }

        const result = await uploadImage({
        folder,
        buffer: req.file.buffer,
        filename: req.file.originalname,
        });

        return res.status(201).json({ ok: true, item: result });
    } catch (e) {
        next(e);
    }
}

export async function deleteMedia(req, res, next) {
    try {
        const { public_id } = req.query;
        const result = await deleteImage({ public_id });

        return res.json({ ok: true, result });
    } catch (e) {
        next(e);
    }
}
