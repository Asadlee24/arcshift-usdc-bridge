@echo off
echo ===================================================
echo        ARC BRIDGE AUTO DEPLOYMENT SCRIPT
echo ===================================================
echo.
echo [1/3] Installing Vercel...
call npm install -g vercel
echo.
echo [2/3] Please login to Vercel (Browser will open)...
call vercel login
echo.
echo [3/3] Deploying project to the internet...
call vercel --build-env INSTALL_COMMAND="npm install --legacy-peer-deps" --env NEXT_PUBLIC_WC_PROJECT_ID="148d42d3d9e29a8a706509f6df849a78" --env NEXT_PUBLIC_ARC_RPC="https://rpc.testnet.arc.network" --prod --yes
echo.
echo ===================================================
echo Deployment Complete! Copy the link shown above.
pause