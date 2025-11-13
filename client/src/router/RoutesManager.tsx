import { Loader2 } from 'lucide-react'
import React, { Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import ProductsPage from '../pages/ProductsPage'

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
            <Route path="/" element={<ProductsPage />} />
            <Route path="/products" element={<ProductsPage />} />
        </Routes>
    )
}

export default RoutesManager