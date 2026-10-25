---
publishDate: 2026-08-18T11:40
title: Searching, Sorting and Pagination
slug: searching-sorting-and-pagination
metadescription: Add a search box, clickable column sorting and page links to a list page using IQueryable, Where, OrderBy, Skip and Take, keep the current filters in every link, and build a reusable paged list helper.
updateDate: 2026-09-14T11:40
author: ['bishal-biswas']
level: 3
tags: ['ef-core', 'linq', 'pagination']
course: dotnet-mvc
---

## A list page that scales

The `Index` action from the CRUD topic loads every product. That is fine for fifty rows and terrible for fifty thousand. A real list page needs three features:

- **Search**: show only rows that match a term.
- **Sort**: click a column heading to order by it.
- **Pagination**: show 20 rows at a time with next and previous links.

All three come down to building one query step by step and running it once.

## Build the query, then run it

`_db.Products` is an `IQueryable<Product>`. Every `Where`, `OrderBy`, `Skip` and `Take` you add changes the SQL that will be sent. Nothing runs until `ToListAsync`. That is what makes this pattern efficient: the database does the filtering, sorting and paging, and only the rows for the current page travel to your app.

```csharp
IQueryable<Product> query = _db.Products.Include(p => p.Category);

// add filters, sorting and paging here

var items = await query.ToListAsync();
```

## Searching

Accept a search term from the query string and filter when it is present:

```csharp
public async Task<IActionResult> Index(string? search)
{
    IQueryable<Product> query = _db.Products.Include(p => p.Category);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(p => p.Name.Contains(search) || p.Category.Name.Contains(search));
    }

    var items = await query.ToListAsync();
    return View(items);
}
```

`Contains` becomes `LIKE '%term%'` in SQL. On SQL Server the comparison follows the database collation, which is usually case insensitive. On SQLite and PostgreSQL it may be case sensitive. `EF.Functions.Like` or comparing lowered strings can help there.

The form is a plain GET so the term appears in the URL and the page can be bookmarked:

```cshtml
<form asp-action="Index" method="get" class="d-flex">
    <input type="text" name="search" value="@ViewData["Search"]" class="form-control" placeholder="Search products" />
    <button type="submit" class="btn btn-outline-primary ms-2">Search</button>
</form>
```

## Sorting

Accept a sort key and switch on it:

```csharp
public async Task<IActionResult> Index(string? search, string? sort)
{
    // ... search as above

    query = sort switch
    {
        "name_desc" => query.OrderByDescending(p => p.Name),
        "price" => query.OrderBy(p => p.Price),
        "price_desc" => query.OrderByDescending(p => p.Price),
        _ => query.OrderBy(p => p.Name)
    };
}
```

Column headings become links that toggle between ascending and descending. Pass the opposite key to each:

```csharp
ViewData["NameSort"] = sort == "name" || sort is null ? "name_desc" : "name";
ViewData["PriceSort"] = sort == "price" ? "price_desc" : "price";
```

```cshtml
<th><a asp-action="Index" asp-route-sort="@ViewData["NameSort"]" asp-route-search="@ViewData["Search"]">Name</a></th>
<th><a asp-action="Index" asp-route-sort="@ViewData["PriceSort"]" asp-route-search="@ViewData["Search"]">Price</a></th>
```

Notice that the sort links also carry the search term. Every link on the page must include every current filter, or clicking one resets the others.

## Pagination

Paging is `Skip` and `Take`, plus a count so you know how many pages exist:

```csharp
const int pageSize = 20;
page = Math.Max(page, 1);

var total = await query.CountAsync();
var items = await query
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();

var totalPages = (int)Math.Ceiling(total / (double)pageSize);
```

`CountAsync` runs `SELECT COUNT(*)` with the same filters. The second query fetches just the rows for this page. Two small queries instead of one huge one.

`Skip` requires a stable `OrderBy`, or the database may return rows in a different order on each page. Always sort before you page.

## A reusable paged list

Rather than passing five separate values to every list view, wrap the results in a small class:

```csharp
public class PagedList<T>
{
    public List<T> Items { get; }
    public int Page { get; }
    public int PageSize { get; }
    public int TotalCount { get; }

    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious => Page > 1;
    public bool HasNext => Page < TotalPages;

    public PagedList(List<T> items, int page, int pageSize, int totalCount)
    {
        Items = items;
        Page = page;
        PageSize = pageSize;
        TotalCount = totalCount;
    }

    public static async Task<PagedList<T>> CreateAsync(IQueryable<T> source, int page, int pageSize)
    {
        var count = await source.CountAsync();
        var items = await source.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedList<T>(items, page, pageSize, count);
    }
}
```

The action becomes one line at the end:

```csharp
var result = await PagedList<Product>.CreateAsync(query, page, 20);
return View(result);
```

And the page links live in a partial you can reuse on every list:

```cshtml
@* Views/Shared/_Pager.cshtml *@
@model (int Page, int TotalPages)

<nav>
    <ul class="pagination">
        <li class="page-item @(Model.Page <= 1 ? "disabled" : "")">
            <a class="page-link" asp-action="Index" asp-route-page="@(Model.Page - 1)" asp-all-route-data="@ViewBag.RouteValues">Previous</a>
        </li>
        @for (var i = 1; i <= Model.TotalPages; i++)
        {
            <li class="page-item @(i == Model.Page ? "active" : "")">
                <a class="page-link" asp-action="Index" asp-route-page="@i" asp-all-route-data="@ViewBag.RouteValues">@i</a>
            </li>
        }
        <li class="page-item @(Model.Page >= Model.TotalPages ? "disabled" : "")">
            <a class="page-link" asp-action="Index" asp-route-page="@(Model.Page + 1)" asp-all-route-data="@ViewBag.RouteValues">Next</a>
        </li>
    </ul>
</nav>
```

`asp-all-route-data` takes a `Dictionary<string, string>` and adds every entry to the URL. That is how the pager keeps `search` and `sort` without listing them one by one.

For many pages, show a window of five or so around the current one instead of every number.

## Putting it together with a view model

The clean version passes one object to the view:

```csharp
public class ProductListViewModel
{
    public string? Search { get; set; }
    public string? Sort { get; set; }
    public PagedList<Product> Results { get; set; } = default!;

    public Dictionary<string, string> RouteValues => new()
    {
        ["search"] = Search ?? "",
        ["sort"] = Sort ?? ""
    };
}
```

The view uses `Model.Search` in the search box, `Model.Sort` for headings and `Model.RouteValues` in every link. No `ViewData` needed.

## Performance notes

- Put an index on columns you search and sort on often. `HasIndex` in `OnModelCreating` does it.
- `Contains` with a leading wildcard cannot use an index. For very large tables, consider full text search.
- Avoid `Count()` on every request if the number rarely changes. Cache it for a minute.
- Never call `ToList()` before `Skip` and `Take`. That loads the whole table into memory and pages it there.

## Quick recap

- Build one `IQueryable` step by step with `Where`, `OrderBy`, `Skip` and `Take`, and run it once with `ToListAsync`.
- Search with a GET form so the term is in the URL, and filter with `Contains`.
- Sort with a switch on a sort key, and make headings link to the opposite direction.
- Page with `Skip` and `Take` after a stable `OrderBy`, plus `CountAsync` for the total.
- Wrap results in a `PagedList<T>` and carry every current filter in every link with `asp-all-route-data`.

<code id="code-content" class="language-csharp">
// Helpers/PagedList.cs
public class PagedList&lt;T&gt;
{
    public List&lt;T&gt; Items { get; }
    public int Page { get; }
    public int PageSize { get; }
    public int TotalCount { get; }
    public int TotalPages =&gt; (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious =&gt; Page &gt; 1;
    public bool HasNext =&gt; Page &lt; TotalPages;

    public PagedList(List&lt;T&gt; items, int page, int pageSize, int totalCount)
    {
        Items = items; Page = page; PageSize = pageSize; TotalCount = totalCount;
    }

    public static async Task&lt;PagedList&lt;T&gt;&gt; CreateAsync(IQueryable&lt;T&gt; source, int page, int pageSize)
    {
        var count = await source.CountAsync();
        var items = await source.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedList&lt;T&gt;(items, page, pageSize, count);
    }
}

// ViewModels/ProductListViewModel.cs
public class ProductListViewModel
{
    public string? Search { get; set; }
    public string? Sort { get; set; }
    public PagedList&lt;Product&gt; Results { get; set; } = default!;

    public string NameSortKey =&gt; Sort == "name" || Sort is null ? "name_desc" : "name";
    public string PriceSortKey =&gt; Sort == "price" ? "price_desc" : "price";

    public Dictionary&lt;string, string&gt; RouteValues =&gt; new()
    {
        ["search"] = Search ?? "",
        ["sort"] = Sort ?? ""
    };
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private const int PageSize = 20;
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    public async Task&lt;IActionResult&gt; Index(string? search, string? sort, int page = 1)
    {
        IQueryable&lt;Product&gt; query = _db.Products.Include(p =&gt; p.Category);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(p =&gt; p.Name.Contains(search) || p.Category.Name.Contains(search));
        }

        query = sort switch
        {
            "name_desc" =&gt; query.OrderByDescending(p =&gt; p.Name),
            "price" =&gt; query.OrderBy(p =&gt; p.Price),
            "price_desc" =&gt; query.OrderByDescending(p =&gt; p.Price),
            _ =&gt; query.OrderBy(p =&gt; p.Name)
        };

        var vm = new ProductListViewModel
        {
            Search = search,
            Sort = sort,
            Results = await PagedList&lt;Product&gt;.CreateAsync(query, Math.Max(page, 1), PageSize)
        };
        return View(vm);
    }
}

// Views/Products/Index.cshtml
//
//   @model ProductListViewModel
//   &lt;form method="get" class="d-flex mb-3"&gt;
//       &lt;input name="search" value="@Model.Search" class="form-control" placeholder="Search" /&gt;
//       &lt;button class="btn btn-outline-primary ms-2"&gt;Search&lt;/button&gt;
//   &lt;/form&gt;
//   &lt;table class="table"&gt;
//       &lt;thead&gt;&lt;tr&gt;
//           &lt;th&gt;&lt;a asp-action="Index" asp-route-sort="@Model.NameSortKey" asp-route-search="@Model.Search"&gt;Name&lt;/a&gt;&lt;/th&gt;
//           &lt;th&gt;&lt;a asp-action="Index" asp-route-sort="@Model.PriceSortKey" asp-route-search="@Model.Search"&gt;Price&lt;/a&gt;&lt;/th&gt;
//           &lt;th&gt;Category&lt;/th&gt;
//       &lt;/tr&gt;&lt;/thead&gt;
//       &lt;tbody&gt;
//       @foreach (var p in Model.Results.Items)
//       {
//           &lt;tr&gt;&lt;td&gt;@p.Name&lt;/td&gt;&lt;td&gt;@p.Price.ToString("C")&lt;/td&gt;&lt;td&gt;@p.Category.Name&lt;/td&gt;&lt;/tr&gt;
//       }
//       &lt;/tbody&gt;
//   &lt;/table&gt;
//   &lt;nav&gt;&lt;ul class="pagination"&gt;
//       &lt;li class="page-item @(Model.Results.HasPrevious ? "" : "disabled")"&gt;
//           &lt;a class="page-link" asp-action="Index" asp-route-page="@(Model.Results.Page - 1)"
//              asp-all-route-data="@Model.RouteValues"&gt;Previous&lt;/a&gt;
//       &lt;/li&gt;
//       @for (var i = 1; i &lt;= Model.Results.TotalPages; i++)
//       {
//           &lt;li class="page-item @(i == Model.Results.Page ? "active" : "")"&gt;
//               &lt;a class="page-link" asp-action="Index" asp-route-page="@i"
//                  asp-all-route-data="@Model.RouteValues"&gt;@i&lt;/a&gt;
//           &lt;/li&gt;
//       }
//       &lt;li class="page-item @(Model.Results.HasNext ? "" : "disabled")"&gt;
//           &lt;a class="page-link" asp-action="Index" asp-route-page="@(Model.Results.Page + 1)"
//              asp-all-route-data="@Model.RouteValues"&gt;Next&lt;/a&gt;
//       &lt;/li&gt;
//   &lt;/ul&gt;&lt;/nav&gt;
</code></pre>
