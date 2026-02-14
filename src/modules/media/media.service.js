import cloudinary from "../../config/cloudinary.js";

export const ALLOWED_FOLDERS = new Set([
    "risas-colores/web/Hero",
    "risas-colores/web/gallery",
    "risas-colores/products",
]);

export function assertAllowedFolder(folder) {
    if (!folder || !ALLOWED_FOLDERS.has(folder)) {
        const allowed = Array.from(ALLOWED_FOLDERS);
        const err = new Error(
        `Folder no permitido. Permitidos: ${allowed.join(" | ")}`
        );
        err.statusCode = 400;
        throw err;
    }
}

export async function listImages({ folder, max = 50, next_cursor = null }) {
    assertAllowedFolder(folder);

    const safeMax = Math.max(1, Math.min(Number(max) || 50, 100));

    const query = cloudinary.search
        .expression(`folder:"${folder}" AND resource_type:image`)
        .sort_by("created_at", "desc")
        .max_results(safeMax);

    if (next_cursor) query.next_cursor(next_cursor);

    const res = await query.execute();

    const items = (res?.resources || []).map((r) => ({
        public_id: r.public_id,
        url: r.secure_url,
        format: r.format,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
        created_at: r.created_at,
        folder: r.folder,
        filename: r.filename,
    }));

    return { items, next_cursor: res?.next_cursor || null };
}

export async function uploadImage({ folder, buffer, filename }) {
    assertAllowedFolder(folder);

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
        {
            folder,
            resource_type: "image",
            overwrite: false,
            use_filename: true,
            unique_filename: true,
            filename_override: filename ? filename.replace(/\.[^.]+$/, "") : undefined,
        },
        (error, result) => {
            if (error) return reject(error);
            resolve({
            public_id: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
            created_at: result.created_at,
            });
        }
        );

        stream.end(buffer);
    });
}

export async function deleteImage({ public_id }) {
    if (!public_id) {
        const err = new Error("Falta public_id");
        err.statusCode = 400;
        throw err;
    }

    const res = await cloudinary.uploader.destroy(public_id, {
        resource_type: "image",
        invalidate: true,
    });

    // res.result puede ser: "ok" | "not found"
    return res;
}
