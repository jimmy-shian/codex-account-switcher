可选：把 Windows 版 codex.exe 放到本目录（项目根目录的 resources/，相对路径），
打包后会随应用分发，运行时优先使用这里，不用再到系统里到处找。
未放置时应用会按 README 的顺序自动侦测 PATH 或常见安装路径下的 codex.exe。
别人 clone 这个项目后，双击 build-exe.bat 一键就能编译，不依赖任何绝对路径。
