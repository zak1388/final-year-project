export default {
    build: {
        sourcemap: true,
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:5718",
                changeOrigin: true,
                secure: false,
                rewrite: path => path.replace(/^\/api/, "")
            }
        }
    }
}
