---
publishDate: 2026-08-17T11:30
title: Relationships and Navigation Properties
slug: relationships-and-navigation-properties
metadescription: Model one to many, one to one and many to many relationships in Entity Framework Core with foreign keys and navigation properties, load related data with Include and ThenInclude, and control delete behaviour.
updateDate: 2026-09-14T11:30
author: ['bishal-biswas']
level: 3
tags: ['ef-core', 'relationships', 'navigation-properties']
course: dotnet-mvc
---

## Tables that point at each other

Real data is connected. A product belongs to a category. An order has many lines. A user has one profile. In the database, these links are foreign keys. In EF Core, they are **navigation properties**: a property on one entity that refers to another entity or a list of them.

Once the navigation is set up, you can write `order.Customer.Name` or `category.Products.Count` and EF Core does the joins.

## One to many

The most common relationship. One category has many products, and each product has exactly one category:

```csharp
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public List<Product> Products { get; set; } = new();   // collection navigation
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public int CategoryId { get; set; }                     // foreign key
    public Category Category { get; set; } = default!;      // reference navigation
}
```

EF Core sees `CategoryId` next to `Category` and understands the pair. The migration creates a `CategoryId` column on `Products` with a foreign key to `Categories`.

You do not need the collection on `Category` if you never navigate that way. You do not strictly need `CategoryId` either, because EF Core would create a shadow key, but having it makes forms and queries much easier.

## Loading related data

By default, navigation properties are **not** loaded. This query gives products whose `Category` is `null`:

```csharp
var products = await _db.Products.ToListAsync();
```

Ask for the related data with `Include`:

```csharp
var products = await _db.Products
    .Include(p => p.Category)
    .ToListAsync();
```

Now `product.Category.Name` works. This is called **eager loading**. EF Core writes a single query with a join.

Go one level deeper with `ThenInclude`:

```csharp
var orders = await _db.Orders
    .Include(o => o.Customer)
    .Include(o => o.Lines)
        .ThenInclude(l => l.Product)
    .ToListAsync();
```

Each `Include` starts from the root entity. `ThenInclude` continues from the previous navigation.

## The N+1 problem

Without `Include`, a loop like this is a trap:

```csharp
foreach (var product in products)
{
    Console.WriteLine(product.Category.Name);   // null, or a query per product with lazy loading
}
```

If lazy loading is enabled, each access to `Category` fires a separate query. A list of 100 products means 101 queries. This is the N+1 problem, and `Include` fixes it with a single join. Keep lazy loading off in web apps and always `Include` what you need.

## Projecting instead of including

When a page only needs a few fields, a projection with `Select` is lighter than `Include`:

```csharp
var rows = await _db.Products
    .Select(p => new ProductRow(p.Id, p.Name, p.Category.Name))
    .ToListAsync();
```

EF Core turns `p.Category.Name` into a join and returns only three columns. You do not need `Include` when you project, because the navigation is used inside the query.

## One to one

A user has one profile and a profile belongs to one user:

```csharp
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public Profile? Profile { get; set; }
}

public class Profile
{
    public int Id { get; set; }
    public string Bio { get; set; } = "";

    public int UserId { get; set; }
    public User User { get; set; } = default!;
}
```

The side with the foreign key, `Profile`, is the dependent. EF Core needs to know which side that is, and it works it out from the presence of `UserId`. If both sides had a key, tell it explicitly in `OnModelCreating`:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<Profile>(p => p.UserId);
```

## Many to many

A product can have many tags and a tag can apply to many products. EF Core creates the join table for you when both sides have a collection:

```csharp
public class Product
{
    public int Id { get; set; }
    public List<Tag> Tags { get; set; } = new();
}

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<Product> Products { get; set; } = new();
}
```

The migration creates a `ProductTag` table with two columns. To add a tag to a product:

```csharp
var product = await _db.Products.Include(p => p.Tags).FirstAsync(p => p.Id == id);
var tag = await _db.Tags.FindAsync(tagId);
product.Tags.Add(tag!);
await _db.SaveChangesAsync();
```

If the join table needs its own data, such as when the tag was added, define the join entity yourself with two one to many relationships.

## Saving related data

Setting the foreign key is the simplest way to link things when creating:

```csharp
var product = new Product { Name = "Keyboard", CategoryId = 2 };
_db.Products.Add(product);
```

Adding through a navigation also works and is handy when the parent is new too:

```csharp
var category = new Category { Name = "Webcams" };
category.Products.Add(new Product { Name = "HD webcam" });
_db.Categories.Add(category);
await _db.SaveChangesAsync();   // inserts both, with the key wired up
```

## Delete behaviour

What should happen to products when their category is deleted? EF Core's default for a required relationship is **cascade**: deleting the category deletes its products. That is often not what you want. Change it:

```csharp
modelBuilder.Entity<Product>()
    .HasOne(p => p.Category)
    .WithMany(c => c.Products)
    .HasForeignKey(p => p.CategoryId)
    .OnDelete(DeleteBehavior.Restrict);
```

| Behaviour | Effect on delete of the parent |
| --- | --- |
| `Cascade` | Children are deleted too |
| `Restrict` | Delete fails if children exist |
| `SetNull` | Foreign key on children becomes null (needs a nullable key) |
| `NoAction` | Database decides, usually the same as Restrict |

For an order and its lines, cascade is right. For a category and its products, restrict is safer.

## Quick recap

- A foreign key property plus a navigation property defines a relationship, and EF Core pairs them by name.
- One to many uses a collection on one side and a reference plus key on the other. One to one puts the key on the dependent. Many to many just needs collections on both sides.
- Related data is not loaded unless you ask with `Include` and `ThenInclude`, or project with `Select`.
- Avoid the N+1 problem by including up front instead of touching navigations in a loop.
- Set `OnDelete` to `Restrict` where cascading deletes would destroy data you want to keep.

<code id="code-content" class="language-csharp">
// Models
public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public Profile? Profile { get; set; }                   // one to one
    public List&lt;Order&gt; Orders { get; set; } = new();       // one to many
}

public class Profile
{
    public int Id { get; set; }
    public string Bio { get; set; } = "";
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = default!;
}

public class Order
{
    public int Id { get; set; }
    public DateTime PlacedOn { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = default!;
    public List&lt;OrderLine&gt; Lines { get; set; } = new();
}

public class OrderLine
{
    public int Id { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = default!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = default!;
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public List&lt;Tag&gt; Tags { get; set; } = new();           // many to many
}

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List&lt;Product&gt; Products { get; set; } = new();
}

// Data/AppDbContext.cs
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }

    public DbSet&lt;Customer&gt; Customers =&gt; Set&lt;Customer&gt;();
    public DbSet&lt;Order&gt; Orders =&gt; Set&lt;Order&gt;();
    public DbSet&lt;Product&gt; Products =&gt; Set&lt;Product&gt;();
    public DbSet&lt;Category&gt; Categories =&gt; Set&lt;Category&gt;();
    public DbSet&lt;Tag&gt; Tags =&gt; Set&lt;Tag&gt;();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity&lt;Customer&gt;()
            .HasOne(c =&gt; c.Profile)
            .WithOne(p =&gt; p.Customer)
            .HasForeignKey&lt;Profile&gt;(p =&gt; p.CustomerId);

        b.Entity&lt;Product&gt;()
            .HasOne(p =&gt; p.Category)
            .WithMany(c =&gt; c.Products)
            .HasForeignKey(p =&gt; p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);      // do not delete products with a category

        b.Entity&lt;OrderLine&gt;()
            .HasOne(l =&gt; l.Order)
            .WithMany(o =&gt; o.Lines)
            .OnDelete(DeleteBehavior.Cascade);       // lines go with their order

        b.Entity&lt;OrderLine&gt;().Property(l =&gt; l.UnitPrice).HasPrecision(10, 2);
    }
}

// Controllers/OrdersController.cs
public class OrdersController : Controller
{
    private readonly AppDbContext _db;
    public OrdersController(AppDbContext db) =&gt; _db = db;

    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var order = await _db.Orders
            .Include(o =&gt; o.Customer)
            .Include(o =&gt; o.Lines)
                .ThenInclude(l =&gt; l.Product)
                    .ThenInclude(p =&gt; p.Category)
            .FirstOrDefaultAsync(o =&gt; o.Id == id);

        if (order is null) return NotFound();
        return View(order);
    }

    // Projection: only the columns the list needs, no Include required
    public async Task&lt;IActionResult&gt; Index()
    {
        var rows = await _db.Orders
            .OrderByDescending(o =&gt; o.PlacedOn)
            .Select(o =&gt; new OrderRow(
                o.Id,
                o.Customer.Name,
                o.PlacedOn,
                o.Lines.Sum(l =&gt; l.Quantity * l.UnitPrice)))
            .ToListAsync();
        return View(rows);
    }

    [HttpPost]
    public async Task&lt;IActionResult&gt; AddTag(int productId, int tagId)
    {
        var product = await _db.Products.Include(p =&gt; p.Tags).FirstAsync(p =&gt; p.Id == productId);
        var tag = await _db.Tags.FindAsync(tagId);
        if (tag is not null &amp;&amp; !product.Tags.Contains(tag))
        {
            product.Tags.Add(tag);
            await _db.SaveChangesAsync();
        }
        return RedirectToAction("Details", "Products", new { id = productId });
    }
}

public record OrderRow(int Id, string CustomerName, DateTime PlacedOn, decimal Total);
</code></pre>
