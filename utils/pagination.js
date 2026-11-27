// Reads ?page=2&pageSize=10 from the URL
const getPagination = (query, defaultSize = 10) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize) || defaultSize, 1), 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

// Builds the list reply the frontend expects
const buildPage = (items, total, page, pageSize) => ({
  items,
  pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
});

module.exports = { getPagination, buildPage };