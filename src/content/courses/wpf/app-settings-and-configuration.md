---
publishDate: 2026-10-25T20:53
title: 'App Settings and Configuration'
slug: app-settings-and-configuration
metadescription: 'Read appsettings.json through the Generic Host with the options pattern, use environments, and save user choices like theme and currency in a small JSON settings file.'
updateDate: 2026-10-25T20:53
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'configuration', 'settings', 'json']
course: wpf
---

## Two kinds of settings

Every app has values that should not be hard coded. CoinJar already has a few: the address of the exchange rate API from [Calling Web APIs with HttpClient](/courses/wpf/calling-web-apis-with-httpclient), the list of categories, a monthly budget. It helps to split them into two groups.

```text
App configuration                     User settings
-----------------------------------   -----------------------------------
Chosen by you, the developer          Chosen by the user, inside the app
Ships with the app                    Created on the user's PC
Read only while the app runs          Changed and saved while it runs
Example: API URL, timeouts, logging   Example: theme, currency, window size
Lives in appsettings.json             Lives in %AppData%\CoinJar\settings.json
```

The first group is handled by the **configuration system** that comes with the Generic Host. The second group needs a small service of your own. This lesson builds both.

## appsettings.json and the host

When you call `Host.CreateApplicationBuilder()` in the `App` constructor, as in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host), the builder already sets up configuration for you. It reads, in this order:

1. `appsettings.json`
2. `appsettings.{Environment}.json`, for example `appsettings.Development.json`
3. environment variables
4. command line arguments

Later sources win. So a value in an environment variable overrides the same value in `appsettings.json`. This **layering** lets you change behavior without touching the shipped file.

### Add the file

Add a file called `appsettings.json` to the project root:

```json
{
  "CoinJar": {
    "MonthlyBudget": 500,
    "Categories": [ "Food", "Transport", "Bills", "Fun", "Other" ]
  },
  "ExchangeRates": {
    "BaseUrl": "https://api.frankfurter.dev/v1/",
    "TimeoutSeconds": 10
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

The `BaseUrl` is still the example API from the last lesson. Now that it lives in a config file, you can point the app at a different service without recompiling.

### Copy it next to the exe

In a web project, `appsettings.json` is copied to the output folder automatically. In a WPF project it is **not**. Tell the build to copy it, in `CoinJar.csproj`:

```xml
<ItemGroup>
  <None Update="appsettings.json">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

In Visual Studio you can do the same by selecting the file and setting **Copy to Output Directory** to **Copy if newer** in the Properties window. If you forget this step, nothing crashes. The file is simply not found and every value is missing, which is very confusing.

### Tell the host where to look

The host looks for `appsettings.json` in its **content root**, which by default is the *current directory*. For a web app that is the project folder. For a desktop app, the current directory depends on how the app was started: a shortcut can set a different "Start in" folder. Point the content root at the folder of the exe instead:

```csharp
HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    ContentRootPath = AppContext.BaseDirectory
});
```

`AppContext.BaseDirectory` is the folder that holds your app's files, wherever it was installed.

## Reading values

`builder.Configuration` holds all the layered values. Sections are joined with a colon:

```csharp
string? url = builder.Configuration["ExchangeRates:BaseUrl"];

int timeout = builder.Configuration.GetValue<int>("ExchangeRates:TimeoutSeconds", 10);
```

`GetValue<T>` converts the text to the type you ask for and returns the default (here `10`) if the key is missing.

That is fine for one or two values. For anything more, use the options pattern.

## The options pattern

The **options pattern** maps a whole configuration section onto a small class. You get one typed object instead of a pile of magic strings.

### Write an options class

```csharp
namespace CoinJar.Services;

public class CoinJarOptions
{
    public const string SectionName = "CoinJar";

    public decimal MonthlyBudget { get; set; } = 500m;
    public string[] Categories { get; set; } = [];
}
```

Property names must match the keys in the JSON section (case does not matter). The default values are used when a key is missing.

### Register it

```csharp
builder.Services.Configure<CoinJarOptions>(
    builder.Configuration.GetSection(CoinJarOptions.SectionName));
```

### Inject it

Any class built by the container can now ask for `IOptions<CoinJarOptions>`:

```csharp
using Microsoft.Extensions.Options;

public partial class SummaryViewModel : ObservableObject
{
    private readonly decimal _budget;

    public SummaryViewModel(IOptions<CoinJarOptions> options)
    {
        _budget = options.Value.MonthlyBudget;
    }
}
```

`options.Value` is the filled in object. The view model does not know or care where the value came from, so a [unit test](/courses/wpf/unit-testing-viewmodels) can pass in `Options.Create(new CoinJarOptions { MonthlyBudget = 100 })`.

### Using config while you register services

Sometimes you need a value during registration itself, such as the base address for `AddHttpClient`. Bind the section to an object right there with `Get<T>()`:

```csharp
ExchangeRateOptions rates = builder.Configuration
    .GetSection("ExchangeRates")
    .Get<ExchangeRateOptions>() ?? new ExchangeRateOptions();

builder.Services.AddHttpClient<IExchangeRateService, ExchangeRateService>(client =>
{
    client.BaseAddress = new Uri(rates.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(rates.TimeoutSeconds);
});
```

## Environments

The host knows which **environment** it runs in. It reads the name from the `DOTNET_ENVIRONMENT` environment variable and uses `Production` when it is not set. That is why a user's PC, which has no such variable, always gets production settings.

On your own PC you can set it to `Development` and add `appsettings.Development.json` with only the values that differ:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  }
}
```

Remember to give this file the same **Copy to Output Directory** setting. One way to set the variable for every run from Visual Studio or `dotnet run` is a launch profile in `Properties/launchSettings.json`:

```json
{
  "profiles": {
    "CoinJar": {
      "commandName": "Project",
      "environmentVariables": {
        "DOTNET_ENVIRONMENT": "Development"
      }
    }
  }
}
```

Environment variables can also override single values. Use a double underscore where JSON uses a colon, for example `ExchangeRates__TimeoutSeconds=30`. This is the same configuration system as in ASP.NET Core, explained in more depth in [Configuration and appsettings](/courses/dotnet-webapi/configuration-and-appsettings).

**Never put secrets in `appsettings.json`.** It ships with the app and anyone can open it in Notepad.

## User settings: a small JSON file

`appsettings.json` sits next to the exe and is read only. For things the **user** changes, like the theme or the currency, you need a file the app can write: in the user's AppData folder, just like the expenses in [Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files).

### The settings class

```csharp
namespace CoinJar.Services;

public class UserSettings
{
    public string Theme { get; set; } = "System";          // System, Light or Dark
    public string CurrencyCulture { get; set; } = "en-US"; // decides the money format
}
```

The currency is stored as a **culture** name such as `en-US` (dollars), `en-GB` (pounds), `de-DE` (euros) or `en-IN` (rupees). A culture bundles the currency symbol with the right number format, so `StringFormat=C` shows `12,50 €` for `de-DE` and `$12.50` for `en-US`.

### The service

```csharp
public interface IUserSettingsService
{
    UserSettings Current { get; }
    void Save();
}
```

The implementation (full version in the code panel) loads the file in its constructor, falls back to defaults if the file is missing or broken, and writes it back in `Save()` with `JsonSerializer`. Register it as a singleton, since there is one settings file:

```csharp
builder.Services.AddSingleton<IUserSettingsService, UserSettingsService>();
```

## Applying the settings

### The theme

You learned about `ThemeMode` in [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes). Setting it from C# gives the WPF0001 error because the API is still marked experimental, so wrap the call:

```csharp
public static class ThemeHelper
{
    public static void Apply(string theme)
    {
#pragma warning disable WPF0001 // ThemeMode is still experimental
        Application.Current.ThemeMode = theme switch
        {
            "Light" => ThemeMode.Light,
            "Dark" => ThemeMode.Dark,
            _ => ThemeMode.System
        };
#pragma warning restore WPF0001
    }
}
```

The theme can change while the app runs, so the settings screen calls `ThemeHelper.Apply` straight after saving.

### The currency and culture

Here is a WPF surprise. Bindings with `StringFormat=C` do **not** use the Windows culture. They use the `Language` property of the element, which defaults to `en-US`. So a user in Germany sees dollars unless you change it.

Fix it once at startup, before the first window is created:

```csharp
var culture = new CultureInfo(settings.CurrencyCulture);

// For C# formatting such as $"{amount:C}"
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.CurrentCulture = culture;

// For XAML bindings such as StringFormat=C
FrameworkElement.LanguageProperty.OverrideMetadata(
    typeof(FrameworkElement),
    new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(culture.IetfLanguageTag)));
```

`OverrideMetadata` changes the default `Language` for every element. It may only be called **once** per run, which is why the currency change in the settings screen says "applies after restart". You will see more about cultures in [Accessibility and Localization](/courses/wpf/accessibility-and-localization).

## A settings screen

The view model reads the current values, lets the user pick new ones, and saves:

```csharp
public partial class SettingsViewModel : ObservableObject
{
    private readonly IUserSettingsService _settings;
    private readonly IDialogService _dialogs;

    public SettingsViewModel(IUserSettingsService settings, IDialogService dialogs)
    {
        _settings = settings;
        _dialogs = dialogs;
        Theme = settings.Current.Theme;
        CurrencyCulture = settings.Current.CurrencyCulture;
    }

    public string[] Themes { get; } = ["System", "Light", "Dark"];
    public string[] Cultures { get; } = ["en-US", "en-GB", "de-DE", "fr-FR", "en-IN", "ja-JP"];

    [ObservableProperty]
    public partial string Theme { get; set; }

    [ObservableProperty]
    public partial string CurrencyCulture { get; set; }

    [RelayCommand]
    private void Save()
    {
        bool cultureChanged = CurrencyCulture != _settings.Current.CurrencyCulture;

        _settings.Current.Theme = Theme;
        _settings.Current.CurrencyCulture = CurrencyCulture;
        _settings.Save();

        ThemeHelper.Apply(Theme);   // takes effect at once

        if (cultureChanged)
        {
            _dialogs.ShowMessage("The new currency is used after you restart CoinJar.");
        }
    }
}
```

`IDialogService.ShowMessage` is the one from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes). The view is two `ComboBox` controls and a button:

```xml
<StackPanel Margin="16" Width="260" HorizontalAlignment="Left">
    <TextBlock Text="Theme" />
    <ComboBox ItemsSource="{Binding Themes}" SelectedItem="{Binding Theme}" Margin="0,4,0,12" />

    <TextBlock Text="Currency format" />
    <ComboBox ItemsSource="{Binding Cultures}" SelectedItem="{Binding CurrencyCulture}" Margin="0,4,0,12" />

    <Button Content="Save" Command="{Binding SaveCommand}" HorizontalAlignment="Left" Padding="16,4" />
</StackPanel>
```

## What about Settings.settings?

Older WPF tutorials, written for .NET Framework, use a `Settings.settings` file and `Properties.Settings.Default.Save()`. That approach stores values in a hidden `user.config` file in a long, version specific folder path. It can still be used in modern .NET, but a plain JSON file is easier to find, back up, read and test, and it fits the host and DI setup you already have.

## Common mistakes

- **`appsettings.json` not copied to the output.** Set **Copy to Output Directory**, or every value comes back empty.
- **Wrong content root.** Set `ContentRootPath = AppContext.BaseDirectory` so the file is found no matter how the app was started.
- **Writing to `appsettings.json` at runtime.** It lives next to the exe, which is read only in Program Files. User choices go to AppData.
- **Secrets in config files.** Anyone can read them. Keep secrets on a server.
- **Expecting `StringFormat=C` to follow Windows.** WPF defaults to `en-US`. Override `FrameworkElement.LanguageProperty` at startup.
- **Calling `OverrideMetadata` twice.** It throws. Do it once, before any window is shown.
- **Crashing on a bad settings file.** Catch `JsonException` and fall back to defaults.

## Quick recap

- App configuration is set by the developer and shipped. User settings are changed by the user and saved per user.
- The Generic Host reads `appsettings.json`, `appsettings.{Environment}.json`, environment variables and command line arguments, with later sources winning.
- In WPF, copy `appsettings.json` to the output folder and set `ContentRootPath` to `AppContext.BaseDirectory`.
- Use the options pattern: `Configure<T>(GetSection(...))` and inject `IOptions<T>`. Use `Get<T>()` when you need values during registration.
- `DOTNET_ENVIRONMENT` picks the environment. Users get `Production` unless you set it.
- Store user settings like theme and currency culture in a small JSON file in AppData, behind an `IUserSettingsService`.
- Apply the theme with `ThemeMode` (inside `#pragma warning disable WPF0001`) and the money format by overriding `FrameworkElement.LanguageProperty` once at startup.

<code id="code-content" class="language-csharp">
// App.xaml.cs
// No StartupUri in App.xaml: OnStartup shows the window.
using System.Globalization;
using System.Windows;
using System.Windows.Markup;
using CoinJar.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
namespace CoinJar;
public partial class App : Application
{
    private readonly IHost _host;
    public App()
    {
        // Look for appsettings.json next to the exe, not in the current directory.
        HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory
        });
        // Options pattern: the "CoinJar" section becomes IOptions&lt;CoinJarOptions&gt;.
        builder.Services.Configure&lt;CoinJarOptions&gt;(
            builder.Configuration.GetSection(CoinJarOptions.SectionName));
        // Values needed during registration: bind the section right here.
        ExchangeRateOptions rates = builder.Configuration
            .GetSection(ExchangeRateOptions.SectionName)
            .Get&lt;ExchangeRateOptions&gt;() ?? new ExchangeRateOptions();
        builder.Services.AddHttpClient&lt;IExchangeRateService, ExchangeRateService&gt;(client =&gt;
        {
            client.BaseAddress = new Uri(rates.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(rates.TimeoutSeconds);
        });
        // User settings: one settings.json file per user.
        builder.Services.AddSingleton&lt;IUserSettingsService, UserSettingsService&gt;();
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        _host = builder.Build();
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        // Apply user settings BEFORE the first window is created.
        UserSettings settings = _host.Services.GetRequiredService&lt;IUserSettingsService&gt;().Current;
        ApplyCulture(settings.CurrencyCulture);
        ThemeHelper.Apply(settings.Theme);
        _host.Start();
        _host.Services.GetRequiredService&lt;MainWindow&gt;().Show();
    }
    protected override void OnExit(ExitEventArgs e)
    {
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose();
        base.OnExit(e);
    }
    private static void ApplyCulture(string cultureName)
    {
        CultureInfo culture;
        try
        {
            culture = new CultureInfo(cultureName);
        }
        catch (CultureNotFoundException)
        {
            culture = new CultureInfo("en-US");
        }
        // C# formatting, for example $"{amount:C}"
        CultureInfo.DefaultThreadCurrentCulture = culture;
        CultureInfo.CurrentCulture = culture;
        // XAML bindings, for example StringFormat=C. Allowed only once per run.
        FrameworkElement.LanguageProperty.OverrideMetadata(
            typeof(FrameworkElement),
            new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(culture.IetfLanguageTag)));
    }
}
// Services/CoinJarOptions.cs
namespace CoinJar.Services;
// Filled from the "CoinJar" and "ExchangeRates" sections of appsettings.json.
public class CoinJarOptions
{
    public const string SectionName = "CoinJar";
    public decimal MonthlyBudget { get; set; } = 500m;
    public string[] Categories { get; set; } = [];
}
public class ExchangeRateOptions
{
    public const string SectionName = "ExchangeRates";
    public string BaseUrl { get; set; } = "https://api.frankfurter.dev/v1/"; // example API
    public int TimeoutSeconds { get; set; } = 10;
}
// Services/UserSettingsService.cs
using System.IO;
using System.Text.Json;
namespace CoinJar.Services;
// What the user can change. Saved in %AppData%\CoinJar\settings.json
public class UserSettings
{
    public string Theme { get; set; } = "System";          // System, Light or Dark
    public string CurrencyCulture { get; set; } = "en-US"; // decides the money format
}
public interface IUserSettingsService
{
    UserSettings Current { get; }
    void Save();
}
public class UserSettingsService : IUserSettingsService
{
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true };
    private readonly string _filePath;
    public UserSettingsService()
    {
        string folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CoinJar");
        Directory.CreateDirectory(folder);
        _filePath = Path.Combine(folder, "settings.json");
        Current = Load();
    }
    public UserSettings Current { get; }
    public void Save()
    {
        string json = JsonSerializer.Serialize(Current, Options);
        File.WriteAllText(_filePath, json);
    }
    private UserSettings Load()
    {
        if (!File.Exists(_filePath))
        {
            return new UserSettings();                    // first run: defaults
        }
        try
        {
            string json = File.ReadAllText(_filePath);
            return JsonSerializer.Deserialize&lt;UserSettings&gt;(json, Options) ?? new UserSettings();
        }
        catch (JsonException)
        {
            return new UserSettings();                    // broken file: defaults
        }
    }
}
// Services/ThemeHelper.cs
using System.Windows;
namespace CoinJar.Services;
public static class ThemeHelper
{
    public static void Apply(string theme)
    {
#pragma warning disable WPF0001 // ThemeMode is still marked experimental
        Application.Current.ThemeMode = theme switch
        {
            "Light" =&gt; ThemeMode.Light,
            "Dark" =&gt; ThemeMode.Dark,
            _ =&gt; ThemeMode.System
        };
#pragma warning restore WPF0001
    }
}
// appsettings.json  (Copy to Output Directory: Copy if newer)
{
  "CoinJar": {
    "MonthlyBudget": 500,
    "Categories": [ "Food", "Transport", "Bills", "Fun", "Other" ]
  },
  "ExchangeRates": {
    "BaseUrl": "https://api.frankfurter.dev/v1/",
    "TimeoutSeconds": 10
  }
}
</code></pre>
