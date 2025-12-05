import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { useTranslation } from 'react-i18next';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">{t('about.title')}</h1>
          <div className="prose prose-lg prose-blue mx-auto text-muted-foreground">
            <p className="lead text-xl text-foreground">
              {t('about.welcome')}
            </p>
            <p>
              {t('about.mission')}
            </p>
            <h3 className="text-foreground font-semibold mt-8 mb-4">{t('about.teamTitle')}</h3>
            <p>
              {t('about.teamDescription')}
            </p>
            <h3 className="text-foreground font-semibold mt-8 mb-4">{t('about.facilitiesTitle')}</h3>
            <p>
              {t('about.facilitiesDescription')}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;
