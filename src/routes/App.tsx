import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { HomePage } from '../pages/customer/HomePage';
import { SearchPage } from '../pages/customer/SearchPage';
import { CartPage } from '../pages/customer/CartPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';
import { FoodPage } from '../pages/customer/FoodPage';
import { HomeOfferPage } from '../pages/customer/HomeOfferPage';
import { TodaySpecialPage } from '../pages/customer/TodaySpecialPage';
import { SimplePage } from '../pages/customer/SimplePage';
import { ReviewsPage } from '../pages/customer/ReviewsPage';
import { WelcomePage } from '../pages/customer/WelcomePage';
import { RoleSelectPage } from '../pages/customer/RoleSelectPage';
import { LoginPage } from '../pages/customer/LoginPage';
import { RegisterPage } from '../pages/customer/RegisterPage';
import { ForgotPasswordPage } from '../pages/customer/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/customer/ResetPasswordPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { SplashScreen } from '../components/SplashScreen';
import { CustomerFavoritesProvider } from '../components/CustomerFavorites';
import { useCartOwnerSync, useSharedDataRealtime } from '../hooks/useSharedDataRealtime';

export default function App() {
  useSharedDataRealtime();
  useCartOwnerSync();
  return <CustomerFavoritesProvider><SplashScreen/><Routes>
    <Route element={<AppLayout/>}>
      <Route path="/" element={<WelcomePage/>}/>
      <Route path="/onboarding" element={<RoleSelectPage/>}/>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/register" element={<RegisterPage/>}/>
      <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
      <Route path="/reset-password" element={<ResetPasswordPage/>}/>
      <Route path="/home" element={<HomePage/>}/>
      <Route path="/todays-special" element={<TodaySpecialPage/>}/>
      <Route path="/menu" element={<Navigate to="/home#food-list" replace/>}/>
      <Route path="/search" element={<SearchPage/>}/>
      <Route path="/food/:id" element={<FoodPage/>}/>
      <Route path="/offers/:offerId" element={<HomeOfferPage/>}/>
      <Route path="/cart" element={<CartPage/>}/>
      <Route path="/checkout" element={<CheckoutPage/>}/>
      <Route path="/reviews" element={<ReviewsPage/>}/>
      <Route path="/reviews/:id" element={<ReviewsPage/>}/>
      {['orders','favorites','addresses','notifications','profile','help','otp','order-success','orders/:id','track/:id'].map(page=><Route key={page} path={`/${page}`} element={<SimplePage page={page}/>}/>)}
    </Route>
    <Route path="/admin/login" element={<LoginPage admin/>}/>
    <Route path="/admin/*" element={<AdminPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></CustomerFavoritesProvider>;
}
