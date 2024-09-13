import { Router } from 'express';

const router = Router();
var db = new Object();


router.get("/:type", (req, res) => {
    let { type } = req.params;
    res.send(db[type] ?? [], 200)
});


router.post("/:type", (req, res) => {
    let { type } = req.params;

    let collection = [...db[type] ?? []];

    if (collection.find(c => c.id === req.body.id)) {
        res.status(409).end();
    } else {
        db[type] = [...db[type] ?? [], req.body];
        res.status(201).end();
    }
});

router.patch("/:type/:id", (req, res) => {
    let { type, id } = req.params;

    db[type] = [...db[type] ?? []].map(item => id === item.id ? req.body : item);

    res.send()
});

router.delete("/:type/:id", (req, res) => {
    let { type, id } = req.params;

    db[type] = [...db[type] ?? []].filter(item => item.id !== id);

    res.send()
});

export default router;