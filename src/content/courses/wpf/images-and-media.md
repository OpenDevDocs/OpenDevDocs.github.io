---
publishDate: 2026-10-25T20:18
title: 'Images, Icons and Media'
slug: images-and-media
metadescription: 'Learn how to show pictures with the Image control, add image files to your project, use icon fonts and vector icons, set a window icon and play audio or video with MediaElement.'
updateDate: 2026-10-25T20:18
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'image', 'icons', 'mediaelement']
course: wpf
---

## Why pictures matter in a desktop app

Text and buttons get the job done, but a few pictures make an app feel finished. A logo in the corner, a small icon on each button and a picture on an empty screen all help people find their way.

WPF gives you a few tools for this:

- The `Image` control shows a picture file such as a PNG or JPG.
- Icon fonts and vector shapes give you sharp little icons at any size.
- The window `Icon` property sets the picture in the title bar and taskbar.
- The `MediaElement` control plays sound and video.

In this lesson you will try each one. You already know how to place controls with panels from [The Grid Panel](/courses/wpf/the-grid-panel) and [StackPanel, WrapPanel and DockPanel](/courses/wpf/stackpanel-wrappanel-and-dockpanel), so we will focus on the pictures themselves.

## Adding an image file to the project

Before you can show a picture, the file has to be part of your app. Make a folder called `Images` in your project and copy a picture into it, for example `coin.png`.

Now tell the build what to do with it. In Visual Studio, select the file, open the Properties window and set **Build Action** to **Resource**. A **resource** here means the file is packed inside your `.exe`, so it travels with the app and nobody can lose it.

You can also do this for a whole folder at once by editing the `.csproj` file:

```xml
<ItemGroup>
  <!-- Pack every file in the Images folder into the app -->
  <Resource Include="Images\**" />
</ItemGroup>
```

The `**` part means "every file in this folder and its sub folders". Add a new picture to the folder later and it is included with no extra work.

## The Image control

The `Image` control shows one picture. Its most important property is `Source`, the path to the file:

```xml
<Image Source="Images/coin.png" Width="64" Height="64" />
```

The path is relative to the project folder, so `Images/coin.png` means "the file `coin.png` inside the `Images` folder". Use forward slashes in XAML paths.

Behind the scenes WPF turns that short path into a longer address called a **pack URI**. You will sometimes see the full form in other people's code:

```xml
<Image Source="pack://application:,,,/Images/coin.png" />
```

Both lines show the same picture. The short form is easier to read, so use it in XAML. The long form is useful in C# code, which you will see in a moment.

### Stretch: how the picture fills its space

When the `Image` is a different size from the picture, the `Stretch` property decides what happens:

| Value | What it does |
| --- | --- |
| `Uniform` | Grows or shrinks to fit, keeps the shape. This is the default. |
| `UniformToFill` | Fills the whole space, keeps the shape, crops the edges. |
| `Fill` | Fills the whole space and squashes the picture if needed. |
| `None` | Shows the picture at its real size. |

```xml
<UniformGrid Columns="4" Height="120">
    <Image Source="Images/coin.png" Stretch="Uniform" />
    <Image Source="Images/coin.png" Stretch="UniformToFill" />
    <Image Source="Images/coin.png" Stretch="Fill" />
    <Image Source="Images/coin.png" Stretch="None" />
</UniformGrid>
```

Put this in a window and resize it. You will quickly see why `Uniform` is the usual choice: the picture never looks stretched. `UniformToFill` is great for header banners and profile photos.

### Keeping small images crisp

When WPF shrinks a picture it smooths it. For tiny icons made of hard pixels this can look blurry. Two settings help:

```xml
<Image Source="Images/pixel-icon.png"
       Width="32" Height="32"
       RenderOptions.BitmapScalingMode="NearestNeighbor"
       SnapsToDevicePixels="True" />
```

`NearestNeighbor` keeps hard pixel edges instead of smoothing them. Use it for pixel art. For normal photos leave the default.

## Loading an image from C# code

Sometimes you only know which picture to show while the app is running, for example when the user picks a file. In code you create a `BitmapImage`, which is the class WPF uses to hold a loaded picture:

```csharp
using System.Windows.Media.Imaging;

// A picture packed inside the app (Build Action: Resource)
LogoImage.Source = new BitmapImage(
    new Uri("pack://application:,,,/Images/coin.png"));

// A picture somewhere on the disk
PhotoImage.Source = new BitmapImage(new Uri(@"C:\Pictures\receipt.jpg"));
```

Here `LogoImage` and `PhotoImage` are `Image` controls with an `x:Name`. In code you must use the full pack URI for packed files, because the short form only works in XAML.

### Letting the user pick a picture

WPF has a ready made "open file" window called `OpenFileDialog`. Here is a button click handler that lets the user choose a receipt photo:

```csharp
using Microsoft.Win32;

private void PickReceipt_Click(object sender, RoutedEventArgs e)
{
    var dialog = new OpenFileDialog
    {
        Title = "Choose a receipt photo",
        Filter = "Pictures|*.png;*.jpg;*.jpeg;*.bmp"
    };

    if (dialog.ShowDialog() == true)
    {
        var bitmap = new BitmapImage();
        bitmap.BeginInit();
        bitmap.UriSource = new Uri(dialog.FileName);
        bitmap.CacheOption = BitmapCacheOption.OnLoad; // read the file now
        bitmap.EndInit();
        ReceiptImage.Source = bitmap;
    }
}
```

`CacheOption = OnLoad` makes WPF read the whole file straight away and then let go of it. Without it, WPF may keep the file locked, and the user cannot delete or rename it while your app runs. You will learn more about dialogs in [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes).

If you load very large photos but show them small, also set `bitmap.DecodePixelWidth = 400;` before `EndInit()`. WPF then stores a small copy in memory instead of the full size photo.

## Icons that stay sharp at any size

A PNG icon looks fine at the size it was drawn, but it can blur when scaled. Two other kinds of icon stay sharp at every size because they are drawn from shapes, not pixels.

### Icon fonts

Windows ships with icon fonts. Each "letter" in the font is a little picture. On Windows 11 the font is **Segoe Fluent Icons**. On Windows 10 it is **Segoe MDL2 Assets**. Many icons share the same code in both fonts.

```xml
<Button Padding="10,4">
    <StackPanel Orientation="Horizontal">
        <!-- &#xE710; is the "Add" (plus) icon -->
        <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                   Text="&#xE710;" Margin="0,0,6,0"
                   VerticalAlignment="Center" />
        <TextBlock Text="Add expense" />
    </StackPanel>
</Button>
```

`&#xE710;` is how you write one character by its number in XAML. The font list `"Segoe Fluent Icons, Segoe MDL2 Assets"` means "use the first font, and fall back to the second if it is missing". Because the icon is text, it takes the button's `Foreground` colour and `FontSize` automatically.

A few handy codes: `E710` add, `E74D` delete, `E70F` edit, `E74E` save, `E721` search, `E713` settings. Microsoft documents the full list on the Segoe Fluent Icons page.

### Vector icons with Path

The `Path` element draws a shape from a short text called **path data**. Icon sites often offer icons in this format (look for "SVG path"). Here is a simple coin:

```xml
<Viewbox Width="24" Height="24">
    <Canvas Width="24" Height="24">
        <Ellipse Width="22" Height="22" Canvas.Left="1" Canvas.Top="1"
                 Fill="Gold" Stroke="DarkGoldenrod" StrokeThickness="2" />
        <Path Data="M12,6 L12,18 M9,9 L15,9 M9,15 L15,15"
              Stroke="DarkGoldenrod" StrokeThickness="2" />
    </Canvas>
</Viewbox>
```

The `Viewbox` from [ScrollViewer and Viewbox](/courses/wpf/scrollviewer-and-viewbox) scales the drawing to whatever size you ask for. Change `Width` and `Height` on the `Viewbox` to 96 and the coin is still perfectly sharp. You will draw more shapes in [Brushes, Shapes and Effects](/courses/wpf/brushes-shapes-and-effects).

## The window icon

The picture in the title bar and taskbar comes from the window's `Icon` property. It works best with a `.ico` file, which can hold several sizes in one file:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Icon="Images/coin.ico"
        Width="600" Height="400">
```

The `.exe` file in File Explorer has its own icon. Set that one in the `.csproj`:

```xml
<PropertyGroup>
  <ApplicationIcon>Images\coin.ico</ApplicationIcon>
</PropertyGroup>
```

Set both and your app looks the same everywhere.

## Playing sound and video with MediaElement

`MediaElement` plays audio and video files such as MP3, WAV and MP4. It uses the media support built into Windows.

There is one important difference from images: `MediaElement` cannot play a file packed inside the `.exe`. The file must sit next to your app on disk. Set its **Build Action** to **Content** and **Copy to Output Directory** to **Copy if newer**, or in the `.csproj`:

```xml
<ItemGroup>
  <Content Include="Media\**" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

### Playing automatically

The simplest use plays the file as soon as the control appears:

```xml
<MediaElement Source="Media/intro.mp4" Width="320" />
```

### Play, pause and stop buttons

Most of the time you want buttons. Set `LoadedBehavior="Manual"` so the control waits for your code, then call its methods:

```xml
<StackPanel>
    <MediaElement x:Name="Player" Source="Media/intro.mp4"
                  LoadedBehavior="Manual" UnloadedBehavior="Stop"
                  Height="180" />
    <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
        <Button Content="Play"  Click="Play_Click"  Margin="4" />
        <Button Content="Pause" Click="Pause_Click" Margin="4" />
        <Button Content="Stop"  Click="Stop_Click"  Margin="4" />
    </StackPanel>
</StackPanel>
```

```csharp
private void Play_Click(object sender, RoutedEventArgs e) => Player.Play();
private void Pause_Click(object sender, RoutedEventArgs e) => Player.Pause();
private void Stop_Click(object sender, RoutedEventArgs e) => Player.Stop();
```

Other useful members: `Volume` (0 to 1), `Position` (where playback is, as a `TimeSpan`), `NaturalDuration` (the length, known after the `MediaOpened` event) and the `MediaEnded` and `MediaFailed` events.

### Just a sound effect

For a short "ding" with no visible control, use `MediaPlayer` from code:

```csharp
using System.Windows.Media;

private readonly MediaPlayer _sound = new();

private void PlayDing()
{
    _sound.Open(new Uri("Media/ding.wav", UriKind.Relative));
    _sound.Play();
}
```

Keep the `MediaPlayer` in a field, as above. If it is only a local variable, the garbage collector may clean it up before the sound finishes.

## Common mistakes

- **The picture does not show and there is no error.** The Build Action is probably wrong. Packed images need **Resource**. If you see nothing, check the file name and folder spelling too. Paths are not checked when you build.
- **Using a short path in C#.** `new Uri("Images/coin.png")` throws an error because a plain relative path is not a full address. Use the `pack://application:,,,/` form or add `UriKind.Relative`.
- **Expecting MediaElement to play a Resource file.** Media must be **Content** copied to the output folder.
- **Forgetting `LoadedBehavior="Manual"`.** Without it, calling `Play()` from code throws an error, because the control is managing playback by itself.
- **Locking user files.** Load pictures the user picked with `BitmapCacheOption.OnLoad`.
- **Blurry icons.** Prefer an icon font or a `Path` over small PNGs. They stay sharp on high resolution screens.

## Quick recap

- Put pictures in an `Images` folder with Build Action **Resource**, then show them with `Image Source="Images/name.png"`.
- `Stretch` decides how a picture fills its space. `Uniform` is the safe default.
- In C#, load pictures with `BitmapImage` and a full pack URI, and use `CacheOption = OnLoad` for user files.
- Icon fonts (`Segoe Fluent Icons`) and `Path` shapes give icons that are sharp at any size.
- Set the title bar icon with `Window.Icon` and the `.exe` icon with `ApplicationIcon`.
- `MediaElement` plays audio and video from **Content** files. Use `LoadedBehavior="Manual"` to control it from code.
- Next you will add menus, a toolbar and a status bar in [Menus, ToolBars and StatusBars](/courses/wpf/menus-toolbars-and-status-bars).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar: pictures and media" Width="640" Height="520"&gt;
    &lt;!-- Remember: Images\** needs Build Action Resource, Media\** needs Content --&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;!-- Header with a vector coin icon and the app name --&gt;
        &lt;StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,12"&gt;
            &lt;Viewbox Width="32" Height="32" Margin="0,0,8,0"&gt;
                &lt;Canvas Width="24" Height="24"&gt;
                    &lt;Ellipse Width="22" Height="22" Canvas.Left="1" Canvas.Top="1"
                             Fill="Gold" Stroke="DarkGoldenrod" StrokeThickness="2" /&gt;
                    &lt;Path Data="M12,6 L12,18 M9,9 L15,9 M9,15 L15,15"
                          Stroke="DarkGoldenrod" StrokeThickness="2" /&gt;
                &lt;/Canvas&gt;
            &lt;/Viewbox&gt;
            &lt;TextBlock Text="CoinJar" FontSize="24" FontWeight="SemiBold"
                       VerticalAlignment="Center" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Buttons with icon font glyphs --&gt;
        &lt;StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,12"&gt;
            &lt;Button Click="PickReceipt_Click" Padding="10,4"&gt;
                &lt;StackPanel Orientation="Horizontal"&gt;
                    &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                               Text="&amp;#xE710;" Margin="0,0,6,0" VerticalAlignment="Center" /&gt;
                    &lt;TextBlock Text="Pick receipt photo" /&gt;
                &lt;/StackPanel&gt;
            &lt;/Button&gt;
            &lt;Button Click="ClearReceipt_Click" Padding="10,4" Margin="8,0,0,0"&gt;
                &lt;StackPanel Orientation="Horizontal"&gt;
                    &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                               Text="&amp;#xE74D;" Margin="0,0,6,0" VerticalAlignment="Center" /&gt;
                    &lt;TextBlock Text="Clear" /&gt;
                &lt;/StackPanel&gt;
            &lt;/Button&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Media player at the bottom --&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Margin="0,12,0,0"&gt;
            &lt;MediaElement x:Name="Player" Source="Media/intro.mp4" Height="120"
                          LoadedBehavior="Manual" UnloadedBehavior="Stop"
                          MediaFailed="Player_MediaFailed" /&gt;
            &lt;StackPanel Orientation="Horizontal" HorizontalAlignment="Center"&gt;
                &lt;Button Content="Play" Click="Play_Click" Margin="4" Padding="10,2" /&gt;
                &lt;Button Content="Pause" Click="Pause_Click" Margin="4" Padding="10,2" /&gt;
                &lt;Button Content="Stop" Click="Stop_Click" Margin="4" Padding="10,2" /&gt;
            &lt;/StackPanel&gt;
            &lt;TextBlock x:Name="MediaStatus" HorizontalAlignment="Center" Foreground="Gray" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- The receipt photo fills the rest of the space --&gt;
        &lt;Border BorderBrush="LightGray" BorderThickness="1" Background="WhiteSmoke"&gt;
            &lt;Grid&gt;
                &lt;TextBlock x:Name="EmptyText" Text="No receipt yet"
                           HorizontalAlignment="Center" VerticalAlignment="Center"
                           Foreground="Gray" /&gt;
                &lt;Image x:Name="ReceiptImage" Stretch="Uniform" Margin="8" /&gt;
            &lt;/Grid&gt;
        &lt;/Border&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using Microsoft.Win32;
using System.Windows.Media.Imaging;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void PickReceipt_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "Choose a receipt photo",
            Filter = "Pictures|*.png;*.jpg;*.jpeg;*.bmp"
        };
        if (dialog.ShowDialog() == true)
        {
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.UriSource = new Uri(dialog.FileName);
            bitmap.CacheOption = BitmapCacheOption.OnLoad; // do not lock the file
            bitmap.DecodePixelWidth = 800;                  // save memory on big photos
            bitmap.EndInit();
            ReceiptImage.Source = bitmap;
            EmptyText.Visibility = Visibility.Collapsed;
        }
    }
    private void ClearReceipt_Click(object sender, RoutedEventArgs e)
    {
        ReceiptImage.Source = null;
        EmptyText.Visibility = Visibility.Visible;
    }
    private void Play_Click(object sender, RoutedEventArgs e)
    {
        Player.Play();
        MediaStatus.Text = "Playing";
    }
    private void Pause_Click(object sender, RoutedEventArgs e)
    {
        Player.Pause();
        MediaStatus.Text = "Paused";
    }
    private void Stop_Click(object sender, RoutedEventArgs e)
    {
        Player.Stop();
        MediaStatus.Text = "Stopped";
    }
    private void Player_MediaFailed(object? sender, ExceptionRoutedEventArgs e)
    {
        // Usually the file is missing from the output folder
        MediaStatus.Text = "Could not play the video: " + e.ErrorException.Message;
    }
}
</code></pre>
