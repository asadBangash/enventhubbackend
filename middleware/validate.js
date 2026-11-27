const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body); // throws ZodError if invalid
  next();
};

module.exports = validate;