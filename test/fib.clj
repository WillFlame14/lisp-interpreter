(let [fib (fn f [x]
            (if (= x 0) 1
              (if (= x 1) 1
                (+ (f (- x 1)) (f (- x 2))))))]
  (fib 40))