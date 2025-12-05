import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              Thakur Dental Clinic
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link to="/">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      {t('navbar.home')}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link to="/about">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      {t('navbar.about')}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link to="/blogs">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      {t('navbar.blogs')}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link to="/contact">
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      {t('navbar.contact')}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            
            <Link to="/login">
              <Button variant="default" className="bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                {t('navbar.signIn')}
              </Button>
            </Link>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                  <div className="absolute right-4 top-4 flex items-center gap-2">
                    <ThemeSwitcher />
                    <LanguageSwitcher />
                  </div>
                </SheetHeader>
                <div className="flex flex-col space-y-4 mt-8">
                  <Link to="/" className="text-lg font-medium hover:text-primary-600 transition-colors">
                    {t('navbar.home')}
                  </Link>
                  <Link to="/about" className="text-lg font-medium hover:text-primary-600 transition-colors">
                    {t('navbar.about')}
                  </Link>
                  <Link to="/blogs" className="text-lg font-medium hover:text-primary-600 transition-colors">
                    {t('navbar.blogs')}
                  </Link>
                  <Link to="/contact" className="text-lg font-medium hover:text-primary-600 transition-colors">
                    {t('navbar.contact')}
                  </Link>
                  <div className="pt-4">
                    <Link to="/login" className="w-full">
                      <Button className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
                        {t('navbar.signIn')}
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
