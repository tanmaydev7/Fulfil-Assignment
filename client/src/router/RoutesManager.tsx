import { Loader2 } from 'lucide-react'
import React, { Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import ProductsPage from '../pages/ProductsPage'
import WebhooksPage from '../pages/WebhooksPage'
import { AppLayout } from '../components/AppLayout'

// Loading component
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" />
    </div>
)

type Props = {}

const RoutesManager = (props: Props) => {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/webhooks" element={<WebhooksPage />} />
                <Route path="*" element={<Navigate to="/products" replace />} />
            </Route>
        </Routes>
    )
}

export default RoutesManager