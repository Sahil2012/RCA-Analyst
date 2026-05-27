const express = require("express");
const supabase = require("../db/supabase");
const logger = require("../utils/logger");
const router = express.Router();

// ─── Helper ───────────────────────────────────────────────
function validate(body, requireAll = true) {
  const errors = [];
  if (requireAll || body.name !== undefined) {
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "")
      errors.push("name is required and must be a non-empty string");
  }
  if (requireAll || body.email !== undefined) {
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      errors.push("email is required and must be a valid email address");
  }
  return errors;
}

// ─── GET /api/users ───────────────────────────────────────
// Query params: ?page=1&limit=10&search=john
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = req.query.search?.trim();
    const from = (page - 1) * limit;

    logger.debug("GET /users - List users", { page, limit, search: !!search });

    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    logger.debug("Users retrieved successfully", { count, pageTotal: data.length });

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    logger.error("Failed to list users", { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/users/:id ───────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug("GET /users/:id - Get user by ID", { id });

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.debug("User not found", { id });
        return res.status(404).json({ success: false, error: "User not found" });
      }
      throw error;
    }

    logger.debug("User retrieved successfully", { id });
    res.json({ success: true, data });
  } catch (err) {
    logger.error("Failed to get user", { id: req.params.id, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/users ──────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) {
      logger.debug("POST /users - Validation failed", { errors });
      return res.status(400).json({ success: false, errors });
    }

    const { name, email } = req.body;
    logger.debug("POST /users - Create user", { email });

    const { data, error } = await supabase
      .from("users")
      .insert([{ name: name.trim(), email: email.toLowerCase().trim() }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        logger.debug("Email already exists", { email });
        return res.status(409).json({ success: false, error: "Email already exists" });
      }
      throw error;
    }

    logger.info("User created successfully", { id: data.id, email });
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error("Failed to create user", { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug("PUT /users/:id - Replace user", { id, email: req.body.email });
    
    const errors = validate(req.body, true);
    if (errors.length) {
      logger.debug("PUT /users/:id - Validation failed", { id, errors });
      return res.status(400).json({ success: false, errors });
    }

    const { name, email } = req.body;

    const { data, error } = await supabase
      .from("users")
      .update({ name: name.trim(), email: email.toLowerCase().trim() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.debug("User not found", { id });
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (error.code === "23505") {
        logger.debug("Email already exists", { id, email });
        return res.status(409).json({ success: false, error: "Email already exists" });
      }
      throw error;
    }

    logger.info("User updated successfully", { id, email });
    res.json({ success: true, data });
  } catch (err) {
    logger.error("Failed to update user", { id: req.params.id, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/users/:id ─────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug("PATCH /users/:id - Partial update", { id, hasName: !!req.body.name, hasEmail: !!req.body.email });

    if (!req.body.name && !req.body.email) {
      logger.debug("PATCH /users/:id - No fields provided", { id });
      return res.status(400).json({ success: false, error: "Provide at least name or email to update" });
    }

    const errors = validate(req.body, false);
    if (errors.length) {
      logger.debug("PATCH /users/:id - Validation failed", { id, errors });
      return res.status(400).json({ success: false, errors });
    }

    const updates = {};
    if (req.body.name)  updates.name  = req.body.name.trim();
    if (req.body.email) updates.email = req.body.email.toLowerCase().trim();

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.debug("User not found", { id });
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (error.code === "23505") {
        logger.debug("Email already exists", { id });
        return res.status(409).json({ success: false, error: "Email already exists" });
      }
      throw error;
    }

    logger.info("User partially updated successfully", { id });
    res.json({ success: true, data });
  } catch (err) {
    logger.error("Failed to partially update user", { id: req.params.id, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug("DELETE /users/:id - Delete user", { id });

    const { data, error } = await supabase
      .from("users")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.debug("User not found", { id });
        return res.status(404).json({ success: false, error: "User not found" });
      }
      throw error;
    }

    logger.info("User deleted successfully", { id });
    res.json({ success: true, message: "User deleted successfully", data });
  } catch (err) {
    logger.error("Failed to delete user", { id: req.params.id, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
