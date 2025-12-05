import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';

const AboutPage: React.FC = () => {
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
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">About Us</h1>
          <div className="prose prose-lg prose-blue mx-auto text-muted-foreground">
            <p className="lead text-xl text-foreground">
              Welcome to Thakur Dental Clinic, where your smile is our top priority. Established in 2010, we have been serving the community with dedication and excellence in dental care.
            </p>
            <p>
              Our mission is to provide comprehensive dental services in a comfortable and hygienic environment. We believe in a patient-centric approach, ensuring that each individual receives personalized care tailored to their specific needs.
            </p>
            <h3 className="text-foreground font-semibold mt-8 mb-4">Our Team</h3>
            <p>
              We are proud to have a team of highly skilled and experienced dentists who are experts in various fields of dentistry, including orthodontics, endodontics, periodontics, and cosmetic dentistry. Our support staff is friendly and always ready to assist you.
            </p>
            <h3 className="text-foreground font-semibold mt-8 mb-4">Our Facilities</h3>
            <p>
              Our clinic is equipped with state-of-the-art technology, including digital X-rays, intraoral cameras, and advanced sterilization systems. We adhere to strict infection control protocols to ensure the safety of our patients and staff.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;
